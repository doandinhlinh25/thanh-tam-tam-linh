import { validateParams } from "../../helpers/validation.helper";
import { validateQuery } from "../../middlewares/query.middleware";
import { Router } from "express";
import multer from "multer";
import * as courseController from "../../controllers/admin/course.controller";
import * as courseValidate from "../../validates/admin/course.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";
import { resolveTenant } from "../../middlewares/tenant/tenant.middleware";

const router = Router();
validateParams(router);
router.use(validateQuery);
const upload = multer({ limits: { fieldSize: 32 * 1024, fields: 20, parts: 20, files: 0 } });

// Tạo môn học mới trong Tenant
router.post(
  "/:tenantId/courses/create",
  resolveTenant,
  checkPermission("course-create"),
  upload.none(),
  courseValidate.createCourse,
  courseController.createCourse
);

// Danh sách môn học trong Tenant
router.get(
  "/:tenantId/courses/list",
  resolveTenant,
  checkPermission("course-list"),
  courseController.courseList
);

// Chi tiết môn học
router.get(
  "/:tenantId/courses/detail/:id",
  resolveTenant,
  checkPermission("course-list"),
  courseController.courseDetail
);

// Cập nhật thông tin môn học
router.patch(
  "/:tenantId/courses/edit/:id",
  resolveTenant,
  checkPermission("course-edit"),
  upload.none(),
  courseValidate.editCourse,
  courseController.courseEdit
);

// Xóa môn học
router.patch(
  "/:tenantId/courses/delete/:id",
  resolveTenant,
  checkPermission("course-delete"),
  courseController.courseDelete
);

// Phân công giảng viên
router.post(
  "/:tenantId/courses/:courseId/assign-lecturer",
  resolveTenant,
  checkPermission("course-assign-lecturer"),
  upload.none(),
  courseValidate.assignLecturer,
  courseController.assignLecturer
);

// Hủy phân công giảng viên
router.delete(
  "/:tenantId/courses/:courseId/remove-lecturer/:userId",
  resolveTenant,
  checkPermission("course-assign-lecturer"),
  courseController.removeLecturer
);

// Ghi danh sinh viên
router.post(
  "/:tenantId/courses/:courseId/enroll",
  resolveTenant,
  checkPermission("course-enroll-student"),
  upload.none(),
  courseValidate.enrollStudent,
  courseController.enrollStudent
);

// Hủy ghi danh sinh viên
router.delete(
  "/:tenantId/courses/:courseId/unenroll/:userId",
  resolveTenant,
  checkPermission("course-enroll-student"),
  courseController.unenrollStudent
);

// Danh sách sinh viên đã ghi danh
router.get(
  "/:tenantId/courses/:courseId/students",
  resolveTenant,
  checkPermission("course-list"),
  courseController.courseStudents
);

export default router;
