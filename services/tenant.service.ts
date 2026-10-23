import mongoose from "mongoose";
import slugify from "slugify";
import Tenant, { ITenant } from "../models/tenant.model";
import TenantMembership from "../models/tenant-membership.model";
import Course from "../models/course.model";
import CourseEnrollment from "../models/course-enrollment.model";

export class TenantService {
  /**
   * Tạo Tenant mới
   */
  static async createTenant(data: {
    name: string;
    code?: string;
    domain?: string;
    description?: string;
    logo?: string;
    plan?: "free" | "pro" | "enterprise";
    quota?: {
      maxUsers?: number;
      maxStorageMB?: number;
      maxCourses?: number;
      maxDailyChats?: number;
    };
    ownerId?: string;
    createdBy?: string;
  }): Promise<ITenant> {
    const rawCode = data.code || slugify(data.name, { lower: true, strict: true });
    const code = rawCode.toLowerCase().trim();

    const existing = await Tenant.findOne({ code, deleted: false });
    if (existing) {
      throw new Error(`Mã Tenant '${code}' đã tồn tại! Vui lòng chọn mã khác.`);
    }

    const searchStr = slugify(`${data.name} ${code} ${data.domain || ""}`, {
      replacement: " ",
      lower: true
    });

    const tenant = new Tenant({
      name: data.name.trim(),
      code: code,
      domain: data.domain?.trim() || null,
      description: data.description?.trim() || "",
      logo: data.logo || null,
      plan: data.plan || "free",
      quota: {
        maxUsers: data.quota?.maxUsers ?? 50,
        maxStorageMB: data.quota?.maxStorageMB ?? 500,
        maxCourses: data.quota?.maxCourses ?? 10,
        maxDailyChats: data.quota?.maxDailyChats ?? 100
      },
      createdBy: data.createdBy ? new mongoose.Types.ObjectId(data.createdBy) : null,
      search: searchStr
    });

    await tenant.save();

    // Nếu có ownerId, tự động gán làm tenant_owner
    if (data.ownerId && mongoose.Types.ObjectId.isValid(data.ownerId)) {
      await TenantMembership.create({
        tenantId: tenant._id,
        userId: new mongoose.Types.ObjectId(data.ownerId),
        role: "tenant_owner",
        status: "active",
        joinedAt: new Date()
      });
    }

    return tenant;
  }

  /**
   * Lấy danh sách Tenant (hỗ trợ phân trang, lọc, tìm kiếm)
   */
  static async getTenants(params: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 10);
    const skip = (page - 1) * limit;

    const filter: any = { deleted: false };

    if (params.status) {
      filter.status = params.status;
    }

    if (params.plan) {
      filter.plan = params.plan;
    }

    if (params.search) {
      const searchRegex = new RegExp(params.search.trim(), "i");
      filter.$or = [{ name: searchRegex }, { code: searchRegex }, { domain: searchRegex }];
    }

    const [tenants, total] = await Promise.all([
      Tenant.find(filter)
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Tenant.countDocuments(filter)
    ]);

    return {
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Lấy chi tiết Tenant theo ID kèm thống kê tổng quan
   */
  static async getTenantById(tenantId: string) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    const tenant = await Tenant.findOne({
      _id: tenantId,
      deleted: false
    })
      .populate("createdBy", "fullName email")
      .lean();

    if (!tenant) {
      throw new Error("Không tìm thấy Tenant!");
    }

    // Thống kê số lượng thành viên, khóa học
    const [memberCount, courseCount, enrollmentCount] = await Promise.all([
      TenantMembership.countDocuments({
        tenantId,
        deleted: false,
        status: "active"
      }),
      Course.countDocuments({
        tenantId,
        deleted: false,
        status: "active"
      }),
      CourseEnrollment.countDocuments({
        tenantId,
        status: "active"
      })
    ]);

    return {
      ...tenant,
      stats: {
        memberCount,
        courseCount,
        enrollmentCount
      }
    };
  }

  /**
   * Cập nhật thông tin Tenant
   */
  static async updateTenant(
    tenantId: string,
    data: {
      name?: string;
      domain?: string;
      description?: string;
      logo?: string;
      plan?: "free" | "pro" | "enterprise";
      quota?: {
        maxUsers?: number;
        maxStorageMB?: number;
        maxCourses?: number;
        maxDailyChats?: number;
      };
    }
  ) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    const tenant = await Tenant.findOne({ _id: tenantId, deleted: false });
    if (!tenant) {
      throw new Error("Không tìm thấy Tenant!");
    }

    if (data.name) {
      tenant.name = data.name.trim();
      tenant.search = slugify(`${tenant.name} ${tenant.code} ${data.domain || tenant.domain || ""}`, {
        replacement: " ",
        lower: true
      });
    }

    if (data.domain !== undefined) tenant.domain = data.domain ? data.domain.trim() : undefined;
    if (data.description !== undefined) tenant.description = data.description.trim();
    if (data.logo !== undefined) tenant.logo = data.logo;
    if (data.plan) tenant.plan = data.plan;

    if (data.quota) {
      tenant.quota = {
        maxUsers: data.quota.maxUsers ?? tenant.quota.maxUsers,
        maxStorageMB: data.quota.maxStorageMB ?? tenant.quota.maxStorageMB,
        maxCourses: data.quota.maxCourses ?? tenant.quota.maxCourses,
        maxDailyChats: data.quota.maxDailyChats ?? tenant.quota.maxDailyChats
      };
    }

    await tenant.save();
    return tenant;
  }

  /**
   * Thay đổi trạng thái Tenant (active/inactive/suspended)
   */
  static async changeStatus(tenantId: string, status: "active" | "inactive" | "suspended") {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    const tenant = await Tenant.findOne({ _id: tenantId, deleted: false });
    if (!tenant) {
      throw new Error("Không tìm thấy Tenant!");
    }

    tenant.status = status;
    await tenant.save();
    return tenant;
  }

  /**
   * Xóa mềm Tenant
   */
  static async deleteTenant(tenantId: string) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    const tenant = await Tenant.findOne({ _id: tenantId, deleted: false });
    if (!tenant) {
      throw new Error("Không tìm thấy Tenant!");
    }

    tenant.deleted = true;
    tenant.deletedAt = new Date();
    await tenant.save();

    // Đánh dấu deleted các memberships
    await TenantMembership.updateMany(
      { tenantId: tenant._id },
      { deleted: true, deletedAt: new Date() }
    );

    return true;
  }

  /**
   * Thống kê chi tiết tài nguyên của Tenant
   */
  static async getTenantStats(tenantId: string) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    const tenant = await Tenant.findOne({ _id: tenantId, deleted: false });
    if (!tenant) {
      throw new Error("Không tìm thấy Tenant!");
    }

    const [membersByRole, courseStats, enrollmentCount] = await Promise.all([
      TenantMembership.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), deleted: false, status: "active" } },
        { $group: { _id: "$role", count: { $sum: 1 } } }
      ]),
      Course.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), deleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      CourseEnrollment.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: "active"
      })
    ]);

    const roleMap: Record<string, number> = {
      tenant_owner: 0,
      tenant_admin: 0,
      lecturer: 0,
      student: 0
    };
    membersByRole.forEach(r => {
      roleMap[r._id] = r.count;
    });

    const totalMembers = Object.values(roleMap).reduce((a, b) => a + b, 0);

    return {
      tenant: {
        id: tenant._id,
        name: tenant.name,
        code: tenant.code,
        plan: tenant.plan,
        quota: tenant.quota
      },
      members: {
        total: totalMembers,
        byRole: roleMap,
        quotaRemaining: Math.max(0, tenant.quota.maxUsers - totalMembers)
      },
      courses: {
        total: courseStats.reduce((sum, item) => sum + item.count, 0),
        byStatus: courseStats,
        quotaRemaining: Math.max(
          0,
          tenant.quota.maxCourses - courseStats.reduce((sum, item) => sum + item.count, 0)
        )
      },
      enrollments: {
        active: enrollmentCount
      }
    };
  }
}
