import crypto from "crypto";
import mongoose from "mongoose";
import Tenant from "../models/tenant.model";
import TenantMembership, { TenantRole, MembershipStatus } from "../models/tenant-membership.model";
import TenantInvitation from "../models/tenant-invitation.model";
import AccountAdmin from "../models/account-admin.model";

export class MembershipService {
  /**
   * Thêm thành viên trực tiếp vào Tenant
   */
  static async addMember(data: {
    tenantId: string;
    userId: string;
    role: TenantRole;
  }) {
    const { tenantId, userId, role } = data;

    if (!mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("ID Tenant hoặc ID người dùng không hợp lệ!");
    }

    const [tenant, user] = await Promise.all([
      Tenant.findOne({ _id: tenantId, deleted: false }),
      AccountAdmin.findOne({ _id: userId, deleted: false })
    ]);

    if (!tenant) throw new Error("Tenant không tồn tại!");
    if (!user) throw new Error("Người dùng không tồn tại!");

    // Kiểm tra quota maxUsers
    const currentMemberCount = await TenantMembership.countDocuments({
      tenantId,
      deleted: false,
      status: "active"
    });

    if (currentMemberCount >= tenant.quota.maxUsers) {
      throw new Error(
        `Tenant đã đạt giới hạn tối đa ${tenant.quota.maxUsers} thành viên! Vui lòng nâng cấp gói.`
      );
    }

    const existingMembership = await TenantMembership.findOne({
      tenantId,
      userId
    });

    if (existingMembership) {
      if (!existingMembership.deleted && existingMembership.status === "active") {
        throw new Error("Người dùng này đã là thành viên trong Tenant!");
      }
      // Khôi phục membership cũ
      existingMembership.role = role;
      existingMembership.status = "active";
      existingMembership.deleted = false;
      existingMembership.deletedAt = undefined;
      existingMembership.joinedAt = new Date();
      await existingMembership.save();
      return existingMembership;
    }

    const newMembership = new TenantMembership({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(userId),
      role,
      status: "active",
      joinedAt: new Date()
    });

    await newMembership.save();
    return newMembership;
  }

  /**
   * Lấy danh sách thành viên trong Tenant (hỗ trợ tìm kiếm, lọc theo vai trò, phân trang)
   */
  static async getMembers(
    tenantId: string,
    params: {
      role?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deleted: false
    };

    if (params.role) filter.role = params.role;
    if (params.status) filter.status = params.status;

    let query = TenantMembership.find(filter)
      .populate("userId", "fullName email avatar phone status")
      .sort({ joinedAt: -1 });

    const [members, total] = await Promise.all([
      query.skip(skip).limit(limit).lean(),
      TenantMembership.countDocuments(filter)
    ]);

    // Lọc theo search (nếu có tìm kiếm theo tên hoặc email của user)
    let filteredMembers = members;
    if (params.search) {
      const searchKey = params.search.toLowerCase();
      filteredMembers = members.filter((m: any) => {
        const u = m.userId;
        return (
          u?.fullName?.toLowerCase().includes(searchKey) ||
          u?.email?.toLowerCase().includes(searchKey)
        );
      });
    }

    return {
      members: filteredMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Cập nhật vai trò của thành viên trong Tenant
   */
  static async updateMemberRole(tenantId: string, memberId: string, role: TenantRole) {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new Error("ID thành viên không hợp lệ!");
    }

    const membership = await TenantMembership.findOne({
      _id: memberId,
      tenantId,
      deleted: false
    });

    if (!membership) {
      throw new Error("Không tìm thấy thành viên trong Tenant!");
    }

    membership.role = role;
    await membership.save();
    return membership;
  }

  /**
   * Thu hồi quyền / Xóa thành viên khỏi Tenant
   */
  static async revokeMember(tenantId: string, memberId: string) {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new Error("ID thành viên không hợp lệ!");
    }

    const membership = await TenantMembership.findOne({
      _id: memberId,
      tenantId,
      deleted: false
    });

    if (!membership) {
      throw new Error("Không tìm thấy thành viên trong Tenant!");
    }

    membership.status = "revoked";
    membership.deleted = true;
    membership.deletedAt = new Date();
    await membership.save();

    return true;
  }

  /**
   * Tạo lời mời tham gia Tenant qua email
   */
  static async createInvitation(data: {
    tenantId: string;
    email: string;
    role: TenantRole;
    invitedBy?: string;
  }) {
    const { tenantId, email, role, invitedBy } = data;
    const cleanEmail = email.toLowerCase().trim();

    const tenant = await Tenant.findOne({ _id: tenantId, deleted: false });
    if (!tenant) throw new Error("Tenant không tồn tại!");

    // Kiểm tra user đã là thành viên chưa
    const existingUser = await AccountAdmin.findOne({ email: cleanEmail, deleted: false });
    if (existingUser) {
      const isMember = await TenantMembership.findOne({
        tenantId,
        userId: existingUser._id,
        deleted: false,
        status: "active"
      });
      if (isMember) {
        throw new Error(`Email ${cleanEmail} đã là thành viên trong Tenant này!`);
      }
    }

    // Token ngẫu nhiên bảo mật 64 ký tự hex
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    const invitation = new TenantInvitation({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      email: cleanEmail,
      role,
      token,
      invitedBy: invitedBy ? new mongoose.Types.ObjectId(invitedBy) : null,
      status: "pending",
      expiresAt
    });

    await invitation.save();
    return invitation;
  }

  /**
   * Danh sách lời mời của Tenant
   */
  static async listInvitations(tenantId: string) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    return await TenantInvitation.find({ tenantId })
      .populate("invitedBy", "fullName email")
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Chấp nhận lời mời tham gia Tenant
   */
  static async acceptInvitation(token: string, userId: string) {
    const invitation = await TenantInvitation.findOne({
      token,
      status: "pending"
    });

    if (!invitation) {
      throw new Error("Lời mời không tồn tại hoặc đã được xử lý!");
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = "expired";
      await invitation.save();
      throw new Error("Lời mời đã hết hạn!");
    }

    const user = await AccountAdmin.findOne({ _id: userId, deleted: false });
    if (!user) throw new Error("Không tìm thấy thông tin tài khoản người dùng!");

    // Thêm vào membership
    await this.addMember({
      tenantId: invitation.tenantId.toString(),
      userId: user._id.toString(),
      role: invitation.role
    });

    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = user._id as mongoose.Types.ObjectId;
    await invitation.save();

    return {
      message: "Chấp nhận lời mời thành công!",
      tenantId: invitation.tenantId,
      role: invitation.role
    };
  }

  /**
   * Hủy lời mời
   */
  static async revokeInvitation(tenantId: string, invitationId: string) {
    const invitation = await TenantInvitation.findOne({
      _id: invitationId,
      tenantId,
      status: "pending"
    });

    if (!invitation) {
      throw new Error("Không tìm thấy lời mời đang chờ xử lý!");
    }

    invitation.status = "revoked";
    await invitation.save();
    return true;
  }
}
