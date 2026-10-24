import { withTenant } from "../helpers/tenant.helper";
import mongoose from "mongoose";
import slugify from "slugify";
import Tenant from "../models/tenant.model";
import TenantMembership from "../models/tenant-membership.model";
import TenantInvitation from "../models/tenant-invitation.model";
import Course from "../models/course.model";
import CourseEnrollment from "../models/course-enrollment.model";
import { AuthClient } from "../helpers/auth.helper";
import { ServiceError } from "../helpers/error.helper";
import { escapeRegex } from "../helpers/tenant.helper";

interface TenantInput {
  name: string;
  code?: string;
  domain?: string;
  description?: string;
  logo?: string;
  plan?: "free" | "pro" | "enterprise";
  quota?: { maxUsers?: number; maxStorageMB?: number; maxCourses?: number; maxDailyChats?: number };
  ownerId?: string;
  createdBy?: string;
}

export class TenantService {
  /** Danh sách tenant của user, không cấp quyền từ tenantId do client tự khai. */
  static async getMyTenants(userId: string, page = 1, limit = 20) {
    const memberships = await TenantMembership.find({
      userId,
      status: "active",
      deleted: false
    }).lean();
    const filter = { _id: { $in: memberships.map((member) => member.tenantId) }, deleted: false };
    const [records, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Tenant.countDocuments(filter)
    ]);
    const roles = new Map(memberships.map((member) => [String(member.tenantId), member.role]));
    return {
      tenants: records.map((tenant) => ({ ...tenant, role: roles.get(String(tenant._id)) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  /** Owner chỉ sửa thông tin tổ chức, không tự nâng quota hoặc đổi plan. */
  static async updateSettings(
    tenantId: string,
    actorId: string,
    data: { name?: string; domain?: string; description?: string; logo?: string }
  ) {
    return withTenant(tenantId, actorId, ["tenant_owner"], async (tenant, session) => {
      if (data.name !== undefined) tenant.name = data.name;
      if (data.domain !== undefined) tenant.domain = data.domain;
      if (data.description !== undefined) tenant.description = data.description;
      if (data.logo !== undefined) tenant.logo = data.logo;
      tenant.search = slugify([tenant.name, tenant.code, tenant.domain || ""].join(" "), {
        lower: true,
        replacement: " "
      });
      await tenant.save({ session });
      return tenant;
    });
  }

  /** Tạo tenant và owner trong cùng transaction. */
  static async createTenant(data: TenantInput) {
    const ownerId = data.ownerId || data.createdBy;
    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId))
      throw new ServiceError("Owner không hợp lệ!");
    await AuthClient.getAccount(ownerId);
    const code = (data.code || slugify(data.name, { lower: true, strict: true }))
      .trim()
      .toLowerCase();
    if (!code) throw new ServiceError("Mã Tenant không hợp lệ!");

    return mongoose.connection.transaction(async (session) => {
      const [tenant] = await Tenant.create(
        [
          {
            name: data.name,
            code,
            domain: data.domain || null,
            description: data.description || "",
            logo: data.logo || null,
            plan: data.plan || "free",
            quota: {
              maxUsers: data.quota?.maxUsers ?? 50,
              maxStorageMB: data.quota?.maxStorageMB ?? 500,
              maxCourses: data.quota?.maxCourses ?? 10,
              maxDailyChats: data.quota?.maxDailyChats ?? 100
            },
            createdBy: data.createdBy,
            search: slugify([data.name, code, data.domain || ""].join(" "), {
              lower: true,
              replacement: " "
            })
          }
        ],
        { session }
      );
      await TenantMembership.create(
        [{ tenantId: tenant._id, userId: ownerId, role: "tenant_owner", status: "active" }],
        { session }
      );
      return tenant;
    });
  }

  static async getTenants(params: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const filter: Record<string, unknown> = { deleted: false };
    if (params.status) filter.status = params.status;
    if (params.plan) filter.plan = params.plan;
    if (params.search) {
      const keyword = new RegExp(escapeRegex(params.search.trim()), "i");
      filter.$or = [{ name: keyword }, { code: keyword }, { domain: keyword }];
    }
    const [tenants, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Tenant.countDocuments(filter)
    ]);
    return { tenants, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getTenantById(tenantId: string) {
    if (!mongoose.Types.ObjectId.isValid(tenantId))
      throw new ServiceError("ID Tenant không hợp lệ!");
    const tenant = await Tenant.findOne({ _id: tenantId, deleted: false }).lean();
    if (!tenant) throw new ServiceError("Không tìm thấy Tenant!", 404);
    return tenant;
  }

  static async updateTenant(tenantId: string, data: Partial<TenantInput>) {
    if (!mongoose.Types.ObjectId.isValid(tenantId))
      throw new ServiceError("ID Tenant không hợp lệ!");
    return mongoose.connection.transaction(async (session) => {
      const tenant = await Tenant.findOneAndUpdate(
        { _id: tenantId, deleted: false },
        { $inc: { revision: 1 } },
        { new: true, session }
      );
      if (!tenant) throw new ServiceError("Không tìm thấy Tenant!", 404);
      if (data.name !== undefined) tenant.name = data.name;
      if (data.domain !== undefined) tenant.domain = data.domain;
      if (data.description !== undefined) tenant.description = data.description;
      if (data.logo !== undefined) tenant.logo = data.logo;
      if (data.plan !== undefined) tenant.plan = data.plan;
      if (data.quota) {
        const memberCount = await TenantMembership.countDocuments({
          tenantId,
          status: "active",
          deleted: false
        }).session(session);
        const courseCount = await Course.countDocuments({ tenantId, deleted: false }).session(
          session
        );
        if (
          (data.quota.maxUsers ?? tenant.quota.maxUsers) < memberCount ||
          (data.quota.maxCourses ?? tenant.quota.maxCourses) < courseCount
        )
          throw new ServiceError("Quota không thể nhỏ hơn tài nguyên đang sử dụng!", 409);
        tenant.quota = {
          maxUsers: data.quota.maxUsers ?? tenant.quota.maxUsers,
          maxStorageMB: data.quota.maxStorageMB ?? tenant.quota.maxStorageMB,
          maxCourses: data.quota.maxCourses ?? tenant.quota.maxCourses,
          maxDailyChats: data.quota.maxDailyChats ?? tenant.quota.maxDailyChats
        };
      }
      tenant.search = slugify([tenant.name, tenant.code, tenant.domain || ""].join(" "), {
        lower: true,
        replacement: " "
      });
      await tenant.save({ session });
      return tenant;
    });
  }

  static async changeStatus(tenantId: string, status: "active" | "inactive" | "suspended") {
    await this.getTenantById(tenantId);
    return Tenant.findOneAndUpdate(
      { _id: tenantId, deleted: false },
      { $set: { status }, $inc: { revision: 1 } },
      { new: true, runValidators: true }
    );
  }

  static async deleteTenant(tenantId: string) {
    await this.getTenantById(tenantId);
    await mongoose.connection.transaction(async (session) => {
      await Tenant.updateOne(
        { _id: tenantId },
        { $set: { deleted: true, deletedAt: new Date() }, $inc: { revision: 1 } },
        { session }
      );
      await TenantMembership.updateMany(
        { tenantId },
        { deleted: true, status: "revoked", deletedAt: new Date() },
        { session }
      );
      await TenantInvitation.updateMany(
        { tenantId, status: "pending" },
        { status: "revoked" },
        { session }
      );
    });
  }

  static async getTenantStats(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);
    const [membersByRole, courseStats, enrollmentCount] = await Promise.all([
      TenantMembership.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            deleted: false,
            status: "active"
          }
        },
        { $group: { _id: "$role", count: { $sum: 1 } } }
      ]),
      Course.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), deleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      CourseEnrollment.countDocuments({ tenantId, status: "active" })
    ]);
    const totalMembers = membersByRole.reduce((total, item) => total + item.count, 0);
    const totalCourses = courseStats.reduce((total, item) => total + item.count, 0);
    return {
      tenant,
      members: {
        total: totalMembers,
        byRole: membersByRole,
        quotaRemaining: Math.max(0, tenant.quota.maxUsers - totalMembers)
      },
      courses: {
        total: totalCourses,
        byStatus: courseStats,
        quotaRemaining: Math.max(0, tenant.quota.maxCourses - totalCourses)
      },
      enrollments: { active: enrollmentCount }
    };
  }
}
