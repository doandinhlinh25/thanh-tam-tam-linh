import { Router } from "express";
import * as accountController from "../../controllers/admin/account.controller";
import * as accountValidate from "../../validates/admin/account.validate";
import { verifyToken } from "../../middlewares/admin/auth.middleware";
import { verifyCsrf, verifyOrigin, rateLimit } from "../../middlewares/security.middleware";
import * as securityController from "../../controllers/admin/account-security.controller";
import {
  authFeatureBody,
  authFeatureQuery,
  validateSessionId
} from "../../dto/request/auth-features.request";

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
router.post(
  "/login/2fa",
  authFeatureBody.loginFactor,
  securityController.challengeRateSubject,
  rateLimit("mfa-login", 20, 900),
  securityController.loginFactor
);
router.post("/logout", securityController.logoutGuard, accountController.logoutPost);
router.use(verifyToken);
router.get("/me", accountController.profileGet);
router.get("/csrf", accountController.csrfGet);
router.get("/sessions", authFeatureQuery(), securityController.sessions);
router.get("/2fa/status", securityController.mfaStatus);
router.get("/login-history", authFeatureQuery(true), securityController.history);
router.use(verifyCsrf);
router.patch("/profile", authFeatureBody.profile, securityController.profile);
router.delete("/sessions/:sessionId", validateSessionId, securityController.revokeSession);
router.post(
  "/logout-all",
  rateLimit("sensitive", 10, 900),
  authFeatureBody.reauth,
  securityController.logoutAll
);
router.post(
  "/email-change/request",
  rateLimit("email-change", 3, 900),
  authFeatureBody.emailRequest,
  securityController.requestEmail
);
router.post(
  "/email-change/confirm",
  rateLimit("email-confirm", 10, 900),
  authFeatureBody.emailConfirm,
  securityController.confirmEmail
);
router.post(
  "/2fa/setup",
  rateLimit("sensitive", 10, 900),
  authFeatureBody.setup,
  securityController.setupMfa
);
router.post(
  "/2fa/enable",
  rateLimit("sensitive", 10, 900),
  authFeatureBody.enable,
  securityController.enableMfa
);
router.post(
  "/2fa/disable",
  rateLimit("sensitive", 10, 900),
  authFeatureBody.reauth,
  securityController.disableMfa
);
router.post(
  "/2fa/recovery-codes/regenerate",
  rateLimit("sensitive", 10, 900),
  authFeatureBody.reauth,
  securityController.regenerateRecovery
);
router.post(
  "/change-password",
  rateLimit("change-password", 10, 900),
  accountValidate.changePassword,
  accountController.changePasswordPost
);
export default router;
