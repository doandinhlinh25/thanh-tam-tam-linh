import { Router } from "express";
import accountRoutes from "./account.route";
import accountAdminRoutes from "./account-admin.route";

const router = Router();
router.use("/account", accountRoutes);
router.use("/account-admin", accountAdminRoutes);
export default router;
