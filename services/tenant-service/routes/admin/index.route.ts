import { Router } from "express";
import tenantRoutes from "./tenant.route";
import membershipRoutes from "./membership.route";
import courseRoutes from "./course.route";
import { verifyToken } from "../../middlewares/admin/auth.middleware";
import { verifyOrigin, verifyCsrf } from "../../middlewares/security.middleware";

const router = Router();
router.use(verifyOrigin, verifyToken, verifyCsrf);
router.use("/tenant", tenantRoutes);
router.use("/tenant", membershipRoutes);
router.use("/tenant", courseRoutes);
export default router;
