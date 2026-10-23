import { Router } from "express";
import accountAdminRoutes from "./account-admin.route"
import accountRoutes from "./account.route"

import * as authMiddleware from "../../middlewares/admin/auth.middleware";

const router = Router();

router.use('/account', accountRoutes)

router.use('/account-admin', authMiddleware.verifyToken, accountAdminRoutes)

export default router;