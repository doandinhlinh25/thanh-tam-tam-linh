import { Router } from "express";
import * as accountValidate from "../../validates/admin/account.validate"
import * as accountController from "../../controllers/admin/account.controller"

const router = Router();

router.post('/login', accountValidate.loginPost, accountController.loginPost)

router.post('/logout', accountController.logoutPost)

export default router;