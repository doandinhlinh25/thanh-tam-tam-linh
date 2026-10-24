import { Router } from "express";
import Joi from "joi";
import * as internalController from "../controllers/internal.controller";
import { verifyService } from "../middlewares/security.middleware";

const router = Router();
router.use(verifyService("AUTH_TENANT_TOKEN"));
router.post("/auth/introspect", internalController.introspect);
router.post("/account/lookup", internalController.lookupAccount);
router.post(
  "/account/provision",
  (req, res, next) => {
    const { error, value } = Joi.object({
      email: Joi.string().trim().lowercase().email().max(254).required()
    }).validate(req.body);
    if (error) {
      res.status(400).json({ code: "error", message: error.details[0].message });
      return;
    }
    req.body = value;
    next();
  },
  internalController.provisionAccount
);
export default router;
