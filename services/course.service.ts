import mongoose from "mongoose";
import slugify from "slugify";
import Tenant from "../models/tenant.model";
import Course, { ICourse, CourseStatus } from "../models/course.model";
import CourseEnrollment from "../models/course-enrollment.model";
import LecturerAssignment from "../models/lecturer-assignment.model";
import TenantMembership from "../models/tenant-membership.model";

export class CourseService {
  /**
   * Tạo môn học mới trong Tenant
   */
  static async createCourse(data: {
    tenantId: string;
    code: string;
    name: string;
    description?: string;
    status?: CourseStatus;
    createdBy?: string;
  }): Promise<ICourse> {
    const { tenantId, code, name, description, status, createdBy } = data;

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("ID Tenant không hợp lệ!");
    }

    const tenant = await Tenant.findOne({ _id: tenantId, deleted: false });
    if (!tenant) throw new Error("Tenant không tồn tại!");

    // Kiểm tra quota maxCourses
    const currentCourseCount = await Course.countDocuments({
      tenantId,
      deleted: false
    });

    if (currentCourseCount >= tenant.quota.maxCourses) {
      throw new Error(
        `Tenant đã đạt giới hạn tối đa ${tenant.quota.maxCourses} môn học! Vui lòng nâng cấp gói.`
      );
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Course.findOne({
      tenantId,
      code: cleanCode,
      deleted: false
    });

    if (existing) {
      throw new Error(`Mã môn học '${cleanCode}' đã tồn tại trong Tenant này!`);
    }

    const searchStr = slugify(`${name} ${cleanCode}`, {
      replacement: " ",
      lower: true
    });

    const course = new Course({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      code: cleanCode,
      name: name.trim(),
      description: description?.trim() || "",
      status: status || "active",
      createdBy: createdBy ? new mongoose.Types.ObjectId(createdBy) : null,
      search: searchStr
    });

    await course.save();
    return course;
  }

  /**
   * Lấy danh sách môn học của Tenant
   */
  static async getCourses(
    tenantId: string,
    params: {
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
    const limit = Math.max(1, Number(params.limit) || 10);
    const skip = (page - 1) * limit;

    const filter: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deleted: false
    };

    if (params.status) {
      filter.status = params.status;
    }

    if (params.search) {
      const searchRegex = new RegExp(params.search.trim(), "i");
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Course.countDocuments(filter)
    ]);

    // Bổ sung số lượng giảng viên và sinh viên vào từng môn học
    const enrichedCourses = await Promise.all(
      courses.map(async (c: any) => {
        const [lecturerCount, studentCount] = await Promise.all([
          LecturerAssignment.countDocuments({ courseId: c._id }),
          CourseEnrollment.countDocuments({ courseId: c._id, status: "active" })
        ]);
        return {
          ...c,
          lecturerCount,
          studentCount
        };
      })
    );

    return {
      courses: enrichedCourses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Lấy chi tiết môn học kèm danh sách giảng viên phụ trách và sinh viên
   */
  static async getCourseDetail(tenantId: string, courseId: string) {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new Error("ID môn học không hợp lệ!");
    }

    const course = await Course.findOne({
      _id: courseId,
      tenantId,
      deleted: false
    })
      .populate("createdBy", "fullName email")
      .lean();

    if (!course) {
      throw new Error("Không tìm thấy môn học trong Tenant này!");
    }

    const [lecturers, studentCount] = await Promise.all([
      LecturerAssignment.find({ courseId })
        .populate("userId", "fullName email avatar phone")
        .lean(),
      CourseEnrollment.countDocuments({ courseId, status: "active" })
    ]);

    return {
      ...course,
      lecturers: lecturers.map((l: any) => l.userId),
      studentCount
    };
  }

  /**
   * Cập nhật thông tin môn học
   */
  static async updateCourse(
    tenantId: string,
    courseId: string,
    data: {
      name?: string;
      description?: string;
      status?: CourseStatus;
    }
  ) {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new Error("ID môn học không hợp lệ!");
    }

    const course = await Course.findOne({
      _id: courseId,
      tenantId,
      deleted: false
    });

    if (!course) {
      throw new Error("Không tìm thấy môn học!");
    }

    if (data.name) {
      course.name = data.name.trim();
      course.search = slugify(`${course.name} ${course.code}`, {
        replacement: " ",
        lower: true
      });
    }

    if (data.description !== undefined) course.description = data.description.trim();
    if (data.status) course.status = data.status;

    await course.save();
    return course;
  }

  /**
   * Xóa mềm môn học
   */
  static async deleteCourse(tenantId: string, courseId: string) {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new Error("ID môn học không hợp lệ!");
    }

    const course = await Course.findOne({
      _id: courseId,
      tenantId,
      deleted: false
    });

    if (!course) {
      throw new Error("Không tìm thấy môn học!");
    }

    course.deleted = true;
    course.deletedAt = new Date();
    await course.save();

    return true;
  }

  /**
   * Phân công giảng viên cho môn học
   */
  static async assignLecturer(data: {
    tenantId: string;
    courseId: string;
    userId: string;
    assignedBy?: string;
  }) {
    const { tenantId, courseId, userId, assignedBy } = data;

    const [course, membership] = await Promise.all([
      Course.findOne({ _id: courseId, tenantId, deleted: false }),
      TenantMembership.findOne({
        tenantId,
        userId,
        deleted: false,
        status: "active"
      })
    ]);

    if (!course) throw new Error("Môn học không tồn tại!");
    if (!membership) throw new Error("Người dùng không phải thành viên của Tenant này!");

    // Giảng viên hoặc admin/owner mới được gán giảng dạy
    if (!["lecturer", "tenant_owner", "tenant_admin"].includes(membership.role)) {
      throw new Error(
        `Người dùng có vai trò '${membership.role}', chỉ vai trò 'lecturer', 'tenant_admin' hoặc 'tenant_owner' mới có thể được phân công giảng dạy!`
      );
    }

    const existing = await LecturerAssignment.findOne({ courseId, userId });
    if (existing) {
      throw new Error("Giảng viên này đã được phân công cho môn học này!");
    }

    const assignment = new LecturerAssignment({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      courseId: new mongoose.Types.ObjectId(courseId),
      userId: new mongoose.Types.ObjectId(userId),
      assignedBy: assignedBy ? new mongoose.Types.ObjectId(assignedBy) : null,
      assignedAt: new Date()
    });

    await assignment.save();
    return assignment;
  }

  /**
   * Hủy phân công giảng viên
   */
  static async removeLecturer(tenantId: string, courseId: string, userId: string) {
    const result = await LecturerAssignment.deleteOne({
      tenantId,
      courseId,
      userId
    });

    if (result.deletedCount === 0) {
      throw new Error("Giảng viên chưa từng được phân công môn học này!");
    }

    return true;
  }

  /**
   * Ghi danh sinh viên vào môn học
   */
  static async enrollStudent(data: {
    tenantId: string;
    courseId: string;
    userId: string;
  }) {
    const { tenantId, courseId, userId } = data;

    const [course, membership] = await Promise.all([
      Course.findOne({ _id: courseId, tenantId, deleted: false }),
      TenantMembership.findOne({
        tenantId,
        userId,
        deleted: false,
        status: "active"
      })
    ]);

    if (!course) throw new Error("Môn học không tồn tại!");
    if (!membership) throw new Error("Người dùng không phải thành viên của Tenant này!");

    const existing = await CourseEnrollment.findOne({ courseId, userId });
    if (existing) {
      if (existing.status === "active") {
        throw new Error("Học viên đã ghi danh môn học này rồi!");
      }
      existing.status = "active";
      existing.enrolledAt = new Date();
      await existing.save();
      return existing;
    }

    const enrollment = new CourseEnrollment({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      courseId: new mongoose.Types.ObjectId(courseId),
      userId: new mongoose.Types.ObjectId(userId),
      status: "active",
      enrolledAt: new Date()
    });

    await enrollment.save();
    return enrollment;
  }

  /**
   * Hủy ghi danh sinh viên
   */
  static async unenrollStudent(tenantId: string, courseId: string, userId: string) {
    const enrollment = await CourseEnrollment.findOne({
      tenantId,
      courseId,
      userId
    });

    if (!enrollment) {
      throw new Error("Học viên chưa từng ghi danh môn học này!");
    }

    enrollment.status = "dropped";
    await enrollment.save();
    return true;
  }

  /**
   * Danh sách sinh viên đã ghi danh môn học
   */
  static async getCourseStudents(tenantId: string, courseId: string) {
    return await CourseEnrollment.find({
      tenantId,
      courseId,
      status: "active"
    })
      .populate("userId", "fullName email avatar phone")
      .sort({ enrolledAt: -1 })
      .lean();
  }
}
