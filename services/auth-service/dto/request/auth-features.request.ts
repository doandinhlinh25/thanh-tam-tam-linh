import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { authFeature } from "../../configs/auth-feature.config";

const token = Joi.string()
  .pattern(/^[A-Za-z0-9_-]{43}$/)
  .required();
const password = Joi.string().min(1).max(128).required();
const factor = {
  otp: Joi.string().pattern(/^\d{6}$/),
  recoveryCode: Joi.string().pattern(/^[A-Za-z0-9_-]{22}$/)
};
const page = {
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(authFeature.maxLimit).default(authFeature.defaultLimit)
};

/** Strict validation ở HTTP boundary; không nhận extra claims do client gửi. */
export const validateAuthBody =
  (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body || {}, { allowUnknown: false });
    if (error) {
      res.status(400).json({
        code: "error",
        message: error.details[0].message,
        reasonCode: "VALIDATION_FAILED"
      });
      return;
    }
    req.body = value;
    next();
  };

/** Schema các thao tác Auth mới; OTP và recovery không được gửi đồng thời. */
export const authFeatureBody = {
  loginFactor: validateAuthBody(
    Joi.object({ challengeToken: token, ...factor }).xor("otp", "recoveryCode")
  ),
  reauth: validateAuthBody(Joi.object({ password, ...factor }).oxor("otp", "recoveryCode")),
  setup: validateAuthBody(Joi.object({ password })),
  enable: validateAuthBody(Joi.object({ setupToken: token, otp: factor.otp.required() })),
  emailRequest: validateAuthBody(
    Joi.object({
      newEmail: Joi.string().trim().lowercase().email().max(254).required(),
      password,
      ...factor
    }).oxor("otp", "recoveryCode")
  ),
  emailConfirm: validateAuthBody(
    Joi.object({ token, password, ...factor }).oxor("otp", "recoveryCode")
  ),
  profile: validateAuthBody(
    Joi.object({
      fullName: Joi.string().trim().min(2).max(120),
      phone: Joi.string().max(30).allow(""),
      description: Joi.string().max(2000).allow(""),
      avatar: Joi.string()
        .uri({ scheme: ["https"] })
        .max(2048)
        .allow(null)
    }).min(1)
  )
};

/** Query đã validate lưu vào locals vì Express 5 không cho gán req.query. */
export const authFeatureQuery =
  (history = false) =>
  (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = Joi.object({
      ...page,
      ...(history ? { outcome: Joi.string().valid("success", "denied") } : {})
    }).validate(req.query);
    if (error) {
      res.status(400).json({
        code: "error",
        message: error.details[0].message,
        reasonCode: "VALIDATION_FAILED"
      });
      return;
    }
    res.locals.authQuery = value;
    next();
  };

/** Reject session ID không hợp lệ trước khi truy vấn MongoDB. */
export const validateSessionId = (req: Request, res: Response, next: NextFunction) => {
  if (!/^[a-fA-F0-9]{24}$/.test(String(req.params.sessionId))) {
    res
      .status(400)
      .json({ code: "error", message: "ID phiên không hợp lệ!", reasonCode: "VALIDATION_FAILED" });
    return;
  }
  next();
};
