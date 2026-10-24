import { Router } from "express";
import * as accountController from "../../controllers/admin/account.controller";
import * as accountValidate from "../../validates/admin/account.validate";
import { verifyToken } from "../../middlewares/admin/auth.middleware";
import { verifyCsrf, verifyOrigin, rateLimit } from "../../middlewares/security.middleware";

const router = Router();
router.use(verifyOrigin);
router.post(
  "/login",
  accountValidate.loginPost,
  rateLimit("login", 15, 900),
  accountController.loginPost
);
router.post(
  "/password/forgot",
  accountValidate.forgotPassword,
  rateLimit("forgot", 10, 900),
  accountController.forgotPasswordPost
);
router.post(
  "/password/reset",
  accountValidate.resetPassword,
  rateLimit("reset", 15, 900),
  accountController.resetPasswordPost
);
// Logout chỉ xóa cookie như duy-tam, kể cả khi JWT đã hết hạn.
router.post("/logout", accountController.logoutPost);
router.use(verifyToken);
router.get("/me", accountController.profileGet);
router.get("/csrf", accountController.csrfGet);
router.use(verifyCsrf);
router.post(
  "/change-password",
  accountValidate.changePassword,
  rateLimit("change-password", 10, 900),
  accountController.changePasswordPost
);
export default router;
