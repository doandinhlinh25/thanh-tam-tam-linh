import { errorResponse } from "../../helpers/error.helper";
import { Response } from "express";
import { AccountRequest } from "../../interfaces/request.interface";
import { CourseService } from "../../services/course.service";

/**
 * Tạo môn học mới trong Tenant
 */
export const createCourse = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const creatorId = req.adminId || req.userId;

    const course = await CourseService.createCourse({
      tenantId,
      ...req.body,
      createdBy: creatorId!
    });

    res.json({
      code: "success",
      message: "Tạo môn học thành công!",
      course
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Danh sách môn học trong Tenant
 */
export const courseList = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const { status, search, page, limit } = req.query;

    const result = await CourseService.getCourses(
      tenantId,
      {
        status: status as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined
      },
      req.adminId!
    );

    res.json({
      code: "success",
      message: "Lấy danh sách môn học thành công!",
      ...result
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Chi tiết môn học
 */
export const courseDetail = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const id = String(req.params.id);

    const course = await CourseService.getCourseDetail(tenantId, id, req.adminId!);

    res.json({
      code: "success",
      message: "Lấy chi tiết môn học thành công!",
      course
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Chỉnh sửa thông tin môn học
 */
export const courseEdit = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const id = String(req.params.id);

    const course = await CourseService.updateCourse(tenantId, id, req.body, req.adminId!);

    res.json({
      code: "success",
      message: "Cập nhật môn học thành công!",
      course
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Xóa mềm môn học
 */
export const courseDelete = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const id = String(req.params.id);

    await CourseService.deleteCourse(tenantId, id, req.adminId!);

    res.json({
      code: "success",
      message: "Xóa môn học thành công!"
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Phân công giảng viên cho môn học
 */
export const assignLecturer = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const courseId = String(req.params.courseId);
    const { userId } = req.body;
    const assignerId = req.adminId || req.userId;

    const assignment = await CourseService.assignLecturer({
      tenantId,
      courseId,
      userId,
      assignedBy: assignerId!
    });

    res.json({
      code: "success",
      message: "Phân công giảng viên thành công!",
      assignment
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Hủy phân công giảng viên khỏi môn học
 */
export const removeLecturer = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const courseId = String(req.params.courseId);
    const userId = String(req.params.userId);

    await CourseService.removeLecturer(tenantId, courseId, userId, req.adminId!);

    res.json({
      code: "success",
      message: "Hủy phân công giảng viên thành công!"
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Ghi danh sinh viên vào môn học
 */
export const enrollStudent = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const courseId = String(req.params.courseId);
    const { userId } = req.body;

    const enrollment = await CourseService.enrollStudent({
      tenantId,
      courseId,
      userId,
      actorId: req.adminId!
    });

    res.json({
      code: "success",
      message: "Ghi danh sinh viên thành công!",
      enrollment
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Hủy ghi danh sinh viên khỏi môn học
 */
export const unenrollStudent = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const courseId = String(req.params.courseId);
    const userId = String(req.params.userId);

    await CourseService.unenrollStudent(tenantId, courseId, userId, req.adminId!);

    res.json({
      code: "success",
      message: "Hủy ghi danh sinh viên thành công!"
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Danh sách sinh viên của môn học
 */
export const courseStudents = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const courseId = String(req.params.courseId);

    const students = await CourseService.getCourseStudents(tenantId, courseId, req.adminId!);

    res.json({
      code: "success",
      message: "Lấy danh sách sinh viên thành công!",
      students
    });
  } catch (error) {
    errorResponse(res, error);
  }
};
