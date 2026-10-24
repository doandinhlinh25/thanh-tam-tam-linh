import mongoose from "mongoose";
import slugify from "slugify";
import Course, { CourseStatus } from "../models/course.model";
import CourseEnrollment from "../models/course-enrollment.model";
import LecturerAssignment from "../models/lecturer-assignment.model";
import TenantMembership from "../models/tenant-membership.model";
import Tenant from "../models/tenant.model";
import { ServiceError } from "../helpers/error.helper";
import { withTenant, escapeRegex } from "../helpers/tenant.helper";

export class CourseService {
  /** Lecturer phải được phân công; student phải có enrollment đang hoạt động. */
  static async canAccessCourse(
    tenantId: string,
    courseId: string,
    userId: string,
    action = "course:read",
    session?: mongoose.ClientSession
  ): Promise<boolean> {
    if (
      ![
        "course:read",
        "document:read",
        "document:upload",
        "document:delete",
        "chat:ask",
        "feedback:write"
      ].includes(action)
    )
      return false;
    const tenant = await Tenant.findOne({
      _id: tenantId,
      status: "active",
      deleted: false
    }).session(session || null);
    const member = await TenantMembership.findOne({
      tenantId,
      userId,
      status: "active",
      deleted: false
    }).session(session || null);
    const course = await Course.findOne({ _id: courseId, tenantId, deleted: false }).session(
      session || null
    );
    if (!tenant || !member || !course) return false;
    if (["tenant_owner", "tenant_admin"].includes(member.role)) return true;
    if (course.status !== "active") return false;
    if (member.role === "lecturer")
      return !!(await LecturerAssignment.exists({ tenantId, courseId, userId }).session(
        session || null
      ));
    if (["document:upload", "document:delete"].includes(action)) return false;
    return !!(await CourseEnrollment.exists({
      tenantId,
      courseId,
      userId,
      status: "active"
    }).session(session || null));
  }

  static async createCourse(data: {
    tenantId: string;
    code: string;
    name: string;
    description?: string;
    status?: CourseStatus;
    createdBy: string;
  }) {
    return withTenant(
      data.tenantId,
      data.createdBy,
      ["tenant_owner", "tenant_admin"],
      async (tenant, session) => {
        const count = await Course.countDocuments({
          tenantId: data.tenantId,
          deleted: false
        }).session(session);
        if (count >= tenant.quota.maxCourses)
          throw new ServiceError("Tenant đã đạt quota môn học!", 409);
        const [course] = await Course.create(
          [
            {
              tenantId: data.tenantId,
              code: data.code.trim().toUpperCase(),
              name: data.name.trim(),
              description: data.description || "",
              status: data.status || "active",
              createdBy: data.createdBy,
              search: slugify([data.name, data.code].join(" "), { lower: true, replacement: " " })
            }
          ],
          { session }
        );
        return course;
      }
    );
  }

  static async getCourses(
    tenantId: string,
    params: { status?: string; search?: string; page?: number; limit?: number },
    userId: string
  ) {
    const member = await TenantMembership.findOne({
      tenantId,
      userId,
      deleted: false,
      status: "active"
    });
    if (!member) throw new ServiceError("Bạn không phải thành viên hoạt động!", 403);
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const filter: Record<string, unknown> = { tenantId, deleted: false };
    if (params.status) filter.status = params.status;
    if (params.search) {
      const keyword = new RegExp(escapeRegex(params.search.trim()), "i");
      filter.$or = [{ name: keyword }, { code: keyword }];
    }
    if (!["tenant_owner", "tenant_admin"].includes(member.role)) {
      const courseIds =
        member.role === "lecturer"
          ? await LecturerAssignment.distinct("courseId", { tenantId, userId })
          : await CourseEnrollment.distinct("courseId", { tenantId, userId, status: "active" });
      filter._id = { $in: courseIds };
      filter.status = "active";
    }
    const [courses, total] = await Promise.all([
      Course.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Course.countDocuments(filter)
    ]);
    return { courses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getCourseDetail(tenantId: string, courseId: string, userId: string) {
    if (!(await this.canAccessCourse(tenantId, courseId, userId)))
      throw new ServiceError("Không có quyền truy cập môn học!", 403);
    const course = await Course.findOne({ _id: courseId, tenantId, deleted: false }).lean();
    const lecturers = await LecturerAssignment.find({ tenantId, courseId }).lean();
    const studentCount = await CourseEnrollment.countDocuments({
      tenantId,
      courseId,
      status: "active"
    });
    return { ...course, lecturers, studentCount };
  }

  static async updateCourse(
    tenantId: string,
    courseId: string,
    data: { name?: string; description?: string; status?: CourseStatus },
    actorId: string
  ) {
    return withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const course = await Course.findOne({ _id: courseId, tenantId, deleted: false }).session(
          session
        );
        if (!course) throw new ServiceError("Không tìm thấy môn học!", 404);
        if (data.name !== undefined) course.name = data.name;
        if (data.description !== undefined) course.description = data.description;
        if (data.status !== undefined) course.status = data.status;
        course.search = slugify([course.name, course.code].join(" "), {
          lower: true,
          replacement: " "
        });
        await course.save({ session });
        return course;
      }
    );
  }

  static async deleteCourse(tenantId: string, courseId: string, actorId: string) {
    return withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const course = await Course.findOneAndUpdate(
          { _id: courseId, tenantId, deleted: false },
          { deleted: true, deletedAt: new Date() },
          { new: true, session }
        );
        if (!course) throw new ServiceError("Không tìm thấy môn học!", 404);
        await CourseEnrollment.updateMany(
          { tenantId, courseId },
          { status: "dropped" },
          { session }
        );
        await LecturerAssignment.deleteMany({ tenantId, courseId }, { session });
      }
    );
  }

  static async assignLecturer(data: {
    tenantId: string;
    courseId: string;
    userId: string;
    assignedBy: string;
  }) {
    return withTenant(
      data.tenantId,
      data.assignedBy,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const course = await Course.findOne({
          _id: data.courseId,
          tenantId: data.tenantId,
          deleted: false
        }).session(session);
        const member = await TenantMembership.findOne({
          tenantId: data.tenantId,
          userId: data.userId,
          deleted: false,
          status: "active",
          role: { $in: ["lecturer", "tenant_owner", "tenant_admin"] }
        }).session(session);
        if (!course || !member)
          throw new ServiceError("Môn học hoặc giảng viên không hợp lệ!", 404);
        const [assignment] = await LecturerAssignment.create([data], { session });
        return assignment;
      }
    );
  }

  static async removeLecturer(tenantId: string, courseId: string, userId: string, actorId: string) {
    return withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const result = await LecturerAssignment.deleteOne(
          { tenantId, courseId, userId },
          { session }
        );
        if (!result.deletedCount) throw new ServiceError("Không tìm thấy phân công!", 404);
      }
    );
  }

  static async enrollStudent(data: {
    tenantId: string;
    courseId: string;
    userId: string;
    actorId: string;
  }) {
    return withTenant(
      data.tenantId,
      data.actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const course = await Course.findOne({
          _id: data.courseId,
          tenantId: data.tenantId,
          deleted: false
        }).session(session);
        const member = await TenantMembership.findOne({
          tenantId: data.tenantId,
          userId: data.userId,
          deleted: false,
          status: "active",
          role: "student"
        }).session(session);
        if (!course || !member) throw new ServiceError("Môn học hoặc sinh viên không hợp lệ!", 404);
        const existing = await CourseEnrollment.findOne({
          tenantId: data.tenantId,
          courseId: data.courseId,
          userId: data.userId
        }).session(session);
        if (existing?.status === "active") throw new ServiceError("Sinh viên đã ghi danh!", 409);
        return CourseEnrollment.findOneAndUpdate(
          { tenantId: data.tenantId, courseId: data.courseId, userId: data.userId },
          { status: "active", enrolledAt: new Date(), completedAt: null },
          { upsert: true, new: true, session }
        );
      }
    );
  }

  static async unenrollStudent(
    tenantId: string,
    courseId: string,
    userId: string,
    actorId: string
  ) {
    return withTenant(
      tenantId,
      actorId,
      ["tenant_owner", "tenant_admin"],
      async (_tenant, session) => {
        const enrollment = await CourseEnrollment.findOneAndUpdate(
          { tenantId, courseId, userId, status: "active" },
          { status: "dropped" },
          { new: true, session }
        );
        if (!enrollment) throw new ServiceError("Không tìm thấy ghi danh!", 404);
      }
    );
  }

  static async getCourseStudents(tenantId: string, courseId: string, userId: string) {
    if (!(await this.canAccessCourse(tenantId, courseId, userId, "document:upload")))
      throw new ServiceError("Không đủ quyền xem danh sách sinh viên!", 403);
    return CourseEnrollment.find({ tenantId, courseId, status: "active" })
      .sort({ enrolledAt: -1 })
      .lean();
  }
}
