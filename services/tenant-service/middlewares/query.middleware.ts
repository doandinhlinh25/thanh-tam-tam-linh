import { Request, Response, NextFunction } from "express";
import Joi from "joi";

/** Chặn phân trang âm, NaN và filter có operator MongoDB. */
export const validateQuery = (req: Request, res: Response, next: NextFunction) => {
  const { error } = Joi.object({
    page: Joi.number().integer().min(1).max(1000000),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().max(100).allow(""),
    role: Joi.string().valid("tenant_owner", "tenant_admin", "lecturer", "student"),
    status: Joi.string().valid(
      "active",
      "inactive",
      "suspended",
      "revoked",
      "draft",
      "archived",
      "pending",
      "accepted",
      "expired"
    ),
    plan: Joi.string().valid("free", "pro", "enterprise")
  }).validate(req.query);
  if (error) {
    res.status(400).json({ code: "error", message: error.details[0].message });
    return;
  }
  next();
};
