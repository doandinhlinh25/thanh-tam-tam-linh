import { Router } from "express";
import * as accountAdminController from "../../controllers/admin/accountAdmin.controller"
import * as accountValidate from "../../validates/admin/account.validate"
// import * as authMiddleware from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

import multer from "multer";

const upload = multer();

router.post('/create', checkPermission("account-admin-create"), upload.none(), accountValidate.createPost, accountAdminController.createPost)

router.get('/list', checkPermission("account-admin-list"), accountAdminController.adminList)

router.get('/detail/:id', checkPermission("account-admin-edit"), accountAdminController.adminDetail)

router.post('/edit/:id', checkPermission("account-admin-edit"), upload.none(), accountValidate.editPost, accountAdminController.adminEdit)

router.patch('/delete/:id', checkPermission("account-admin-delete"), accountAdminController.adminDelete)

router.patch('/change-profile', checkPermission("account-admin-change-password"), upload.none(), accountValidate.profileChangePatch, accountAdminController.profileChangePatch)

export default router;