import { Router } from "express";
import { verifyService, verifyContextCsrf } from "../middlewares/security.middleware";
import { verifyToken } from "../middlewares/admin/auth.middleware";
import * as internalController from "../controllers/internal.controller";
import * as internalValidate from "../validates/internal.validate";

const router = Router();
router.post(
  "/authorization/context",
  verifyService("CHAT_SERVICE_TOKEN"),
  verifyToken,
  internalValidate.authorizationContext,
  verifyContextCsrf,
  internalController.authorizationContext
);
// Credential Document không được gọi API quota hoặc giả mạo danh tính người dùng.
router.post(
  "/authorization/course",
  verifyService("DOCUMENT_SERVICE_TOKEN"),
  verifyToken,
  internalValidate.courseAuthorization,
  internalController.authorizeUpload
);
router.post(
  "/authorization/check",
  verifyService("CHAT_SERVICE_TOKEN"),
  verifyToken,
  internalValidate.checkAuthorization,
  internalController.checkAuthorization
);
router.post(
  "/quota/chat/consume",
  verifyService("CHAT_SERVICE_TOKEN"),
  verifyToken,
  internalValidate.consumeQuota,
  internalController.consumeChatQuota
);
export default router;
