import { Router } from "express";
import multer from "multer";
import * as membershipController from "../../controllers/admin/tenantMembership.controller";
import * as membershipValidate from "../../validates/admin/membership.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";
import { resolveTenant } from "../../middlewares/tenant/tenant.middleware";

const router = Router();
const upload = multer();

// Chấp nhận lời mời (User tự gọi qua token)
router.post(
  "/invitations/accept",
  upload.none(),
  membershipValidate.acceptInvitation,
  membershipController.acceptInvitation
);

// Thêm thành viên trực tiếp vào Tenant
router.post(
  "/:tenantId/members/add",
  resolveTenant,
  checkPermission("tenant-member-manage"),
  upload.none(),
  membershipValidate.addMember,
  membershipController.addMember
);

// Danh sách thành viên của Tenant
router.get(
  "/:tenantId/members/list",
  resolveTenant,
  checkPermission("tenant-member-list"),
  membershipController.memberList
);

// Cập nhật vai trò thành viên
router.patch(
  "/:tenantId/members/:memberId/role",
  resolveTenant,
  checkPermission("tenant-member-manage"),
  upload.none(),
  membershipValidate.updateRole,
  membershipController.changeMemberRole
);

// Thu hồi quyền thành viên
router.patch(
  "/:tenantId/members/:memberId/revoke",
  resolveTenant,
  checkPermission("tenant-member-manage"),
  membershipController.revokeMember
);

// Tạo lời mời tham gia Tenant
router.post(
  "/:tenantId/invitations/create",
  resolveTenant,
  checkPermission("tenant-member-manage"),
  upload.none(),
  membershipValidate.createInvitation,
  membershipController.createInvitation
);

// Danh sách lời mời của Tenant
router.get(
  "/:tenantId/invitations/list",
  resolveTenant,
  checkPermission("tenant-member-list"),
  membershipController.listInvitations
);

// Hủy lời mời
router.patch(
  "/:tenantId/invitations/:invitationId/revoke",
  resolveTenant,
  checkPermission("tenant-member-manage"),
  membershipController.revokeInvitation
);

export default router;
