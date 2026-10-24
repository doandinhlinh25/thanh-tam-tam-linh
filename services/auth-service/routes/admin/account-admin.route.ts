import { validateParams } from "../../helpers/validation.helper";
import { Router } from "express";
import * as accountController from "../../controllers/admin/accountAdmin.controller";
import * as accountValidate from "../../validates/admin/account.validate";
import { verifyToken, requirePlatformAdmin } from "../../middlewares/admin/auth.middleware";
import { verifyOrigin, verifyCsrf } from "../../middlewares/security.middleware";

const router = Router();
validateParams(router);
router.use(verifyOrigin, verifyToken, verifyCsrf, requirePlatformAdmin);
router.post("/create", accountValidate.createPost, accountController.createPost);
router.get("/list", accountValidate.listAccounts, accountController.adminList);
router.get("/detail/:id", accountController.adminDetail);
router.patch("/edit/:id", accountValidate.editPost, accountController.adminEdit);
router.patch("/delete/:id", accountController.adminDelete);
router.post("/:id/send-activation", accountController.sendActivation);
export default router;
