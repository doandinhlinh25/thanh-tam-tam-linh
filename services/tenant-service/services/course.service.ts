import mongoose from "mongoose";
import slugify from "slugify";
import Course, { CourseStatus } from "../models/course.model";
import CourseEnrollment from "../models/course-enrollment.model";
import LecturerAssignment from "../models/lecturer-assignment.model";
import TenantMembership from "../models/tenant-membership.model";
import Tenant from "../models/tenant.model";
import { ServiceError } from "../helpers/error.helper";
import { withTenant, escapeRegex } from "../helpers/tenant.helper";

const COURSE_READ_ACTION = "course:read";
const DOCUMENT_UPLOAD_ACTION = "document:upload";
const CHAT_ASK_ACTION = "chat:ask";
const ACTIVE_COURSE_STATUS = "active";
const ACTIVE_TENANT_STATUS = "active";
const ACTIVE_MEMBERSHIP_STATUS = "active";
const ACTIVE_ENROLLMENT_STATUS = "active";
const COURSE_CONTENT_ACTIONS = new Set([DOCUMENT_UPLOAD_ACTION, CHAT_ASK_ACTION]);
const TENANT_MANAGER_ROLES = new Set(["tenant_owner", "tenant_admin"]);
const STUDENT_LIST_ROLES = new Set(["tenant_owner", "tenant_admin", "lecturer"]);
const STUDENT_LIST_FORBIDDEN_STATUS = 403;
const STUDENT_LIST_FORBIDDEN_MESSAGE = "Không đủ quyền xem danh sách sinh viên!";

/** Manages courses and evaluates tenant-scoped course permissions. */
export class CourseService {
  /**
   * Checks a verified user's current tenant membership and course access.
   * Upload and chat require an active course even for tenant managers.
   *
   * @param tenantId Tenant that owns the course.
   * @param courseId Course whose permission is checked.
   * @param userId Verified Auth user ID.
   * @param action Existing course action to authorize.
   * @param session Optional MongoDB transaction session.
   * @returns Whether the user has the requested permission.
   * @throws Database errors when the authorization lookup fails.
   */
  static async canAccessCourse(
    tenantId: string,
    courseId: string,
    userId: string,
    action = COURSE_READ_ACTION,
    session?: mongoose.ClientSession
  ): Promise<boolean> {
    if (
      ![
        COURSE_READ_ACTION,
        "document:read",
        DOCUMENT_UPLOAD_ACTION,
        "document:delete",
        CHAT_ASK_ACTION,
        "feedback:write"
      ].includes(action)
    )
      return false;
    const tenant = await Tenant.findOne({
      _id: tenantId,
      status: ACTIVE_TENANT_STATUS,
      deleted: false
    }).session(session || null);
    const member = await TenantMembership.findOne({
      tenantId,
      userId,
      status: ACTIVE_MEMBERSHIP_STATUS,
      deleted: false
    }).session(session || null);
    const course = await Course.findOne({ _id: courseId, tenantId, deleted: false }).session(
      session || null
    );
    if (!tenant || !member || !course) return false;
    if (course.status !== ACTIVE_COURSE_STATUS && COURSE_CONTENT_ACTIONS.has(action)) return false;
    if (TENANT_MANAGER_ROLES.has(member.role)) return true;
    if (course.status !== ACTIVE_COURSE_STATUS) return false;
    if (member.role === "lecturer")
      return !!(await LecturerAssignment.exists({ tenantId, courseId, userId }).session(
        session || null
      ));
    if ([DOCUMENT_UPLOAD_ACTION, "document:delete"].includes(action)) return false;
    return !!(await CourseEnrollment.exists({
      tenantId,
      courseId,
      userId,
      status: ACTIVE_ENROLLMENT_STATUS
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

  /**
   * Lists active enrollments for a manager or assigned lecturer without granting students access.
   *
   * @param tenantId Tenant that owns the course.
   * @param courseId Course whose enrollments are listed.
   * @param userId Verified Auth user ID.
   * @returns Active enrollment records in enrollment order.
   * @throws ServiceError when the user lacks course or student-list permission.
   */
  static async getCourseStudents(tenantId: string, courseId: string, userId: string) {
    if (!(await this.canAccessCourse(tenantId, courseId, userId, COURSE_READ_ACTION)))
      throw new ServiceError(STUDENT_LIST_FORBIDDEN_MESSAGE, STUDENT_LIST_FORBIDDEN_STATUS);
    const member = await TenantMembership.findOne({
      tenantId,
      userId,
      status: ACTIVE_MEMBERSHIP_STATUS,
      deleted: false
    }).select("role");
    if (!member || !STUDENT_LIST_ROLES.has(member.role))
      throw new ServiceError(STUDENT_LIST_FORBIDDEN_MESSAGE, STUDENT_LIST_FORBIDDEN_STATUS);
    return CourseEnrollment.find({ tenantId, courseId, status: ACTIVE_ENROLLMENT_STATUS })
      .sort({ enrolledAt: -1 })
      .lean();
  }
}
