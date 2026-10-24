import { resolveTenant } from "../../middlewares/tenant/tenant.middleware";
import { validateParams } from "../../helpers/validation.helper";
import { validateQuery } from "../../middlewares/query.middleware";
import { Router } from "express";
import multer from "multer";
import * as tenantController from "../../controllers/admin/tenant.controller";
import * as tenantValidate from "../../validates/admin/tenant.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();
validateParams(router);
router.use(validateQuery);
const upload = multer({ limits: { fieldSize: 32 * 1024, fields: 20, parts: 20, files: 0 } });
router.get("/my-tenants", tenantController.myTenants);
router.get("/:tenantId/detail", resolveTenant, tenantController.memberTenantDetail);
router.patch(
  "/:tenantId/settings",
  resolveTenant,
  upload.none(),
  tenantValidate.editSettings,
  tenantController.editSettings
);

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
  tenantValidate.changeStatus,
  tenantController.tenantChangeStatus
);

// Xóa mềm Tenant
router.patch("/delete/:id", checkPermission("tenant-delete"), tenantController.tenantDelete);

// Thống kê tài nguyên Tenant
router.get("/stats/:id", checkPermission("tenant-stats"), tenantController.tenantStats);

export default router;
