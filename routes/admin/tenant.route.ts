import { Router } from "express";
import multer from "multer";
import * as tenantController from "../../controllers/admin/tenant.controller";
import * as tenantValidate from "../../validates/admin/tenant.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();
const upload = multer();

// Tạo mới Tenant
router.post(
  "/create",
  checkPermission("tenant-create"),
  upload.none(),
  tenantValidate.createTenant,
  tenantController.createTenant
);

// Danh sách Tenant
router.get("/list", checkPermission("tenant-list"), tenantController.tenantList);

// Chi tiết Tenant
router.get("/detail/:id", checkPermission("tenant-list"), tenantController.tenantDetail);

// Cập nhật thông tin Tenant
router.patch(
  "/edit/:id",
  checkPermission("tenant-edit"),
  upload.none(),
  tenantValidate.editTenant,
  tenantController.tenantEdit
);

// Đổi trạng thái Tenant (active/inactive/suspended)
router.patch(
  "/change-status/:id",
  checkPermission("tenant-edit"),
  upload.none(),
  tenantController.tenantChangeStatus
);

// Xóa mềm Tenant
router.patch("/delete/:id", checkPermission("tenant-delete"), tenantController.tenantDelete);

// Thống kê tài nguyên Tenant
router.get("/stats/:id", checkPermission("tenant-stats"), tenantController.tenantStats);

export default router;
