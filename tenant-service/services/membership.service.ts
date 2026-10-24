import mongoose from "mongoose";
import TenantMembership, { TenantRole } from "../models/tenant-membership.model";
import TenantInvitation from "../models/tenant-invitation.model";
import LecturerAssignment from "../models/lecturer-assignment.model";
import CourseEnrollment from "../models/course-enrollment.model";
import { AuthClient } from "../helpers/auth.helper";
import { createToken, hashToken } from "../helpers/token.helper";
import { sendMail } from "../helpers/mail.helper";
import { ServiceError } from "../helpers/error.helper";
import { withTenant } from "../helpers/tenant.helper";

export class MembershipService {
  static async resendInvitation(tenantId: string, invitationId: string, actorId: string) {
    const previous = await withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const invitation = await TenantInvitation.findOne({
          _id: invitationId,
          tenantId,
          status: { $in: ["pending", "expired"] }
        }).session(session);
        const actor = await TenantMembership.findOne({ tenantId, userId: actorId }).session(
          session
        );
        if (!invitation) throw new ServiceError("Không tìm thấy lời mời đang chờ!", 404);
        if (!this.canManageRole(actor!.role, invitation.role))
          throw new ServiceError("Không đủ quyền gửi lại lời mời!", 403);
        return { email: invitation.email, role: invitation.role };
      }
    );
    return this.createInvitation({
      tenantId,
      email: previous.email,
      role: previous.role,
      invitedBy: actorId
    });
  }

  /** Admin không được tự cấp vai trò owner hoặc quản lý owner/admin khác. */
  static canManageRole(actorRole: string, role: string, currentRole?: string): boolean {
    return (
      actorRole === "tenant_owner" ||
      (actorRole === "tenant_admin" &&
        ![role, currentRole].some((value) => value === "tenant_owner" || value === "tenant_admin"))
    );
  }

  static async addMember(data: {
    tenantId: string;
    userId: string;
    role: TenantRole;
    actorId: string;
  }) {
    if (!mongoose.Types.ObjectId.isValid(data.userId))
      throw new ServiceError("ID tài khoản không hợp lệ!");
    await AuthClient.getAccount(data.userId);
    return withTenant(
      data.tenantId,
      data.actorId,
      ["tenant_owner", "tenant_admin"],
      async (tenant, session) => {
        const actor = await TenantMembership.findOne({
          tenantId: data.tenantId,
          userId: data.actorId
        }).session(session);
        const existing = await TenantMembership.findOne({
          tenantId: data.tenantId,
          userId: data.userId
        }).session(session);
        if (!this.canManageRole(actor!.role, data.role, existing?.role))
          throw new ServiceError("Không được cấp hoặc quản lý vai trò này!", 403);
        if (existing && !existing.deleted && existing.status === "active")
          throw new ServiceError("Người dùng đã là thành viên!", 409);
        const count = await TenantMembership.countDocuments({
          tenantId: data.tenantId,
          deleted: false,
          status: "active"
        }).session(session);
        if (count >= tenant.quota.maxUsers)
          throw new ServiceError("Tenant đã đạt quota thành viên!", 409);
        return TenantMembership.findOneAndUpdate(
          { tenantId: data.tenantId, userId: data.userId },
          {
            role: data.role,
            status: "active",
            deleted: false,
            deletedAt: null,
            joinedAt: new Date()
          },
          { new: true, upsert: true, session }
        );
      }
    );
  }

  static async getMembers(
    tenantId: string,
    params: { role?: string; status?: string; search?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const filter: Record<string, unknown> = { tenantId, deleted: false };
    if (params.role) filter.role = params.role;
    if (params.status) filter.status = params.status;
    // Chỉ tìm external user ID; tìm tên/email phải qua Auth API, không join database.
    if (params.search) {
      if (!mongoose.Types.ObjectId.isValid(params.search))
        return { members: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      filter.userId = params.search;
    }
    const [members, total] = await Promise.all([
      TenantMembership.find(filter)
        .sort({ joinedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TenantMembership.countDocuments(filter)
    ]);
    return { members, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async updateMemberRole(
    tenantId: string,
    memberId: string,
    role: TenantRole,
    actorId: string
  ) {
    return withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const member = await TenantMembership.findOne({
          _id: memberId,
          tenantId,
          deleted: false,
          status: "active"
        }).session(session);
        const actor = await TenantMembership.findOne({ tenantId, userId: actorId }).session(
          session
        );
        if (!member) throw new ServiceError("Không tìm thấy thành viên!", 404);
        if (!this.canManageRole(actor!.role, role, member.role))
          throw new ServiceError("Không được quản lý vai trò này!", 403);
        if (
          member.role === "tenant_owner" &&
          role !== "tenant_owner" &&
          (await TenantMembership.countDocuments({
            tenantId,
            role: "tenant_owner",
            status: "active",
            deleted: false
          }).session(session)) <= 1
        )
          throw new ServiceError("Tenant phải còn ít nhất một owner!", 409);
        if (member.role !== role) {
          await LecturerAssignment.deleteMany({ tenantId, userId: member.userId }, { session });
          await CourseEnrollment.updateMany(
            { tenantId, userId: member.userId },
            { status: "dropped" },
            { session }
          );
        }
        member.role = role;
        await member.save({ session });
        return member;
      }
    );
  }

  static async revokeMember(tenantId: string, memberId: string, actorId: string) {
    return withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const member = await TenantMembership.findOne({
          _id: memberId,
          tenantId,
          deleted: false,
          status: "active"
        }).session(session);
        const actor = await TenantMembership.findOne({ tenantId, userId: actorId }).session(
          session
        );
        if (!member) throw new ServiceError("Không tìm thấy thành viên!", 404);
        if (!this.canManageRole(actor!.role, "student", member.role))
          throw new ServiceError("Không được thu hồi thành viên này!", 403);
        if (
          member.role === "tenant_owner" &&
          (await TenantMembership.countDocuments({
            tenantId,
            role: "tenant_owner",
            status: "active",
            deleted: false
          }).session(session)) <= 1
        )
          throw new ServiceError("Không thể thu hồi owner cuối cùng!", 409);
        member.status = "revoked";
        member.deleted = true;
        member.deletedAt = new Date();
        await member.save({ session });
        await LecturerAssignment.deleteMany({ tenantId, userId: member.userId }, { session });
        await CourseEnrollment.updateMany(
          { tenantId, userId: member.userId },
          { status: "dropped" },
          { session }
        );
      }
    );
  }

  static async createInvitation(data: {
    tenantId: string;
    email: string;
    role: TenantRole;
    invitedBy: string;
  }) {
    if (data.role === "tenant_owner")
      throw new ServiceError("Không được mời trực tiếp vai trò owner!");
    const token = createToken();
    const seconds = Number(process.env.INVITATION_SECONDS || 604800);
    if (!Number.isSafeInteger(seconds) || seconds <= 0)
      throw new ServiceError("Thời hạn lời mời không hợp lệ!", 500);
    const invitation = await withTenant(
      data.tenantId,
      data.invitedBy,
      ["tenant_owner", "tenant_admin"],
      async (tenant, session) => {
        const actor = await TenantMembership.findOne({
          tenantId: data.tenantId,
          userId: data.invitedBy
        }).session(session);
        if (!this.canManageRole(actor!.role, data.role))
          throw new ServiceError("Không được mời vai trò này!", 403);
        await TenantInvitation.updateMany(
          { tenantId: data.tenantId, email: data.email, status: "pending" },
          { status: "revoked" },
          { session }
        );
        const pending = await TenantInvitation.countDocuments({
          tenantId: data.tenantId,
          status: "pending",
          expiresAt: { $gt: new Date() }
        }).session(session);
        const activeMembers = await TenantMembership.countDocuments({
          tenantId: data.tenantId,
          status: "active",
          deleted: false
        }).session(session);
        if (activeMembers + pending >= tenant.quota.maxUsers)
          throw new ServiceError("Quá nhiều lời mời đang chờ!", 409);
        const [record] = await TenantInvitation.create(
          [
            {
              tenantId: data.tenantId,
              email: data.email,
              role: data.role,
              tokenHash: hashToken(token),
              invitedBy: data.invitedBy,
              expiresAt: new Date(Date.now() + seconds * 1000)
            }
          ],
          { session }
        );
        return record;
      }
    );
    try {
      const account = await AuthClient.provisionAccount(data.email);
      if (
        await TenantMembership.exists({
          tenantId: data.tenantId,
          userId: account.id,
          status: "active",
          deleted: false
        })
      ) {
        throw new ServiceError("Tài khoản đã là thành viên của Tenant!", 409);
      }
      await sendMail(
        data.email,
        "Lời mời tham gia Tenant",
        [process.env.APP_URL, "/accept-invitation#token=", token].join("")
      );
    } catch (error) {
      // Không để lời mời gửi thất bại chiếm quota pending mãi mãi.
      await TenantInvitation.updateOne(
        { _id: invitation._id, status: "pending" },
        { status: "revoked" }
      );
      throw error;
    }
    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt
    };
  }

  static async listInvitations(tenantId: string, params: { page?: string; limit?: string } = {}) {
    await TenantInvitation.updateMany(
      { tenantId, status: "pending", expiresAt: { $lte: new Date() } },
      { status: "expired" }
    );
    const page = Number(params.page || 1),
      limit = Number(params.limit || 20);
    const [invitations, total] = await Promise.all([
      TenantInvitation.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TenantInvitation.countDocuments({ tenantId })
    ]);
    return {
      invitations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  /** Email lấy từ session đã xác minh, không nhận từ body. */
  static async acceptInvitation(token: string, userId: string, email: string) {
    const invitation = await TenantInvitation.findOne({
      tokenHash: hashToken(token),
      status: "pending",
      expiresAt: { $gt: new Date() }
    });
    if (!invitation || invitation.email !== email)
      throw new ServiceError("Lời mời không hợp lệ hoặc không dành cho tài khoản này!", 403);
    return mongoose.connection.transaction(async (session) => {
      const Tenant = (await import("../models/tenant.model")).default;
      const tenant = await Tenant.findOneAndUpdate(
        { _id: invitation.tenantId, deleted: false, status: "active" },
        { $inc: { revision: 1 } },
        { new: true, session }
      );
      if (!tenant) throw new ServiceError("Tenant không hoạt động!", 403);
      const actor = await TenantMembership.findOne({
        tenantId: tenant._id,
        userId: invitation.invitedBy,
        status: "active",
        deleted: false
      }).session(session);
      if (!actor || !this.canManageRole(actor.role, invitation.role))
        throw new ServiceError("Người mời không còn đủ quyền!", 403);
      const consumed = await TenantInvitation.findOneAndUpdate(
        { _id: invitation._id, status: "pending", expiresAt: { $gt: new Date() } },
        { status: "accepted", acceptedAt: new Date(), acceptedBy: userId },
        { new: true, session }
      );
      if (!consumed) throw new ServiceError("Lời mời đã được xử lý!", 409);
      const existing = await TenantMembership.findOne({ tenantId: tenant._id, userId }).session(
        session
      );
      if (existing && existing.status === "active" && !existing.deleted)
        throw new ServiceError("Bạn đã là thành viên!", 409);
      const count = await TenantMembership.countDocuments({
        tenantId: tenant._id,
        status: "active",
        deleted: false
      }).session(session);
      if (count >= tenant.quota.maxUsers)
        throw new ServiceError("Tenant đã đạt quota thành viên!", 409);
      await TenantMembership.findOneAndUpdate(
        { tenantId: tenant._id, userId },
        {
          role: invitation.role,
          status: "active",
          deleted: false,
          deletedAt: null,
          joinedAt: new Date()
        },
        { upsert: true, session }
      );
      return {
        message: "Chấp nhận lời mời thành công!",
        tenantId: tenant._id,
        role: invitation.role
      };
    });
  }

  static async revokeInvitation(tenantId: string, invitationId: string, actorId: string) {
    return withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const invitation = await TenantInvitation.findOne({
          _id: invitationId,
          tenantId,
          status: "pending"
        }).session(session);
        const actor = await TenantMembership.findOne({ tenantId, userId: actorId }).session(
          session
        );
        if (!invitation) throw new ServiceError("Không tìm thấy lời mời đang chờ!", 404);
        if (!this.canManageRole(actor!.role, invitation.role))
          throw new ServiceError("Không đủ quyền thu hồi lời mời này!", 403);
        invitation.status = "revoked";
        await invitation.save({ session });
      }
    );
  }
}
