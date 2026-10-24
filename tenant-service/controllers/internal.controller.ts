import { Response } from "express";
import Course from "../models/course.model";
import { AccountRequest } from "../interfaces/request.interface";
import { CourseService } from "../services/course.service";
import { QuotaService } from "../services/quota.service";
import { errorResponse, ServiceError } from "../helpers/error.helper";

/** Document chỉ gửi courseId; tenantId và userId lấy từ nguồn đã xác minh. */
export const authorizeUpload = async (req: AccountRequest, res: Response) => {
  try {
    const course = await Course.findOne({ _id: req.body.courseId, deleted: false });
    if (
      !course ||
      !(await CourseService.canAccessCourse(
        String(course.tenantId),
        course.id,
        req.adminId!,
        "document:upload"
      ))
    ) {
      throw new ServiceError("Không có quyền tải tài liệu lên môn học!", 403);
    }
    res.json({
      code: "success",
      successful: true,
      data: {
        allowed: true,
        tenantId: String(course.tenantId),
        userId: req.adminId
      }
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const checkAuthorization = async (req: AccountRequest, res: Response) => {
  try {
    const { tenantId, courseId, action } = req.body;
    if (!(await CourseService.canAccessCourse(tenantId, courseId, req.adminId!, action))) {
      throw new ServiceError("Không có quyền truy cập môn học!", 403);
    }
    res.json({
      code: "success",
      successful: true,
      data: { allowed: true, tenantId, userId: req.adminId }
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const consumeChatQuota = async (req: AccountRequest, res: Response) => {
  try {
    const { tenantId, courseId, requestId } = req.body;
    const result = await QuotaService.consumeChat(tenantId, courseId, req.adminId!, requestId);
    res.json({ code: "success", ...result });
  } catch (error) {
    errorResponse(res, error);
  }
};
