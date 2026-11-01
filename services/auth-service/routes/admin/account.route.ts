import { Router } from "express";
import * as accountController from "../../controllers/admin/account.controller";
import * as accountValidate from "../../validates/admin/account.validate";
import { verifyToken } from "../../middlewares/admin/auth.middleware";
import { verifyCsrf, verifyOrigin, rateLimit } from "../../middlewares/security.middleware";

const router = Router();
router.use(verifyOrigin);
router.post(
  "/login",
  rateLimit("login", 15, 900),
  accountValidate.loginPost,
  accountController.loginPost
);
router.post(
  "/password/forgot",
  rateLimit("forgot", 10, 900),
  accountValidate.forgotPassword,
  accountController.forgotPasswordPost
);
router.post(
  "/password/reset",
  rateLimit("reset", 15, 900),
  accountValidate.resetPassword,
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
  rateLimit("change-password", 10, 900),
  accountValidate.changePassword,
  accountController.changePasswordPost
);
export default router;
