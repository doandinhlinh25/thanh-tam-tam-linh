import { Router } from "express";

import * as settingController from "../../controllers/admin/setting.controller";

import * as roleValidate from "../../validates/admin/role.validate"
import multer from "multer";
import { storage } from "../../helpers/cloudinary.helper";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const upload = multer({
  storage: storage
});

router.get('/role/permisions', checkPermission("role-create"), settingController.permisionsList)

router.post('/role/create', checkPermission("role-create"), roleValidate.createPost, settingController.roleCreatePost)

router.get('/role/list', checkPermission("role-list"), settingController.roleList)

router.get('/role/detail/:id', checkPermission("role-edit"), settingController.roleDetail)

router.post('/role/edit/:id', checkPermission("role-edit"), roleValidate.createPost, settingController.roleEdit)

router.patch('/role/delete/:id', checkPermission("role-delete"), settingController.roleDelete)

router.get('/role/trash/list', checkPermission("role-trash"), settingController.roleTrashList)

router.patch('/role/trash/destroy/:id', checkPermission("role-trash"), settingController.roleDestroy)

router.patch('/role/trash/undo/:id', checkPermission("role-trash"), settingController.roleUndo)

export default router;