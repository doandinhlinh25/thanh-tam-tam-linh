import { Router } from "express";
import accountAdminRoutes from "./account-admin.route";
import accountRoutes from "./account.route";
import settingRoutes from "./setting.route";
import tenantRoutes from "./tenant.route";
import membershipRoutes from "./membership.route";
import courseRoutes from "./course.route";

import * as authMiddleware from "../../middlewares/admin/auth.middleware";

const router = Router();

// Route xác thực (login, logout) - không cần verify token
router.use("/account", accountRoutes);

// Route quản trị hệ thống
router.use("/account-admin", authMiddleware.verifyToken, accountAdminRoutes);
router.use("/setting", authMiddleware.verifyToken, settingRoutes);

// Route Tenant Service (Tenant, Membership, Course)
router.use("/tenant", authMiddleware.verifyToken, tenantRoutes);
router.use("/tenant", authMiddleware.verifyToken, membershipRoutes);
router.use("/tenant", authMiddleware.verifyToken, courseRoutes);

export default router;
