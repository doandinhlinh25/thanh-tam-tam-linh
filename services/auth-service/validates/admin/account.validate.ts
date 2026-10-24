import { Request, Response, NextFunction } from "express";
import Joi from "joi";

const email = Joi.string().trim().lowercase().email().max(254).required();
const password = Joi.string().min(12).max(128).required();

const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: true, allowUnknown: false });
    if (error) {
      res.status(400).json({ code: "error", message: error.details[0].message });
      return;
    }
    req.body = value;
    next();
  };
};

export const loginPost = validateBody(
  Joi.object({
    email,
    password: Joi.string().min(1).max(128).required(),
    rememberPassword: Joi.boolean().default(false)
  })
);
export const createPost = validateBody(
  Joi.object({
    fullName: Joi.string().trim().min(2).max(120).required(),
    email,
    password,
    confirmPassword: Joi.valid(Joi.ref("password")).required(),
    status: Joi.string().valid("initial", "active", "inactive").default("initial")
  })
);
export const editPost = validateBody(
  Joi.object({
    fullName: Joi.string().trim().min(2).max(120),
    status: Joi.string().valid("initial", "active", "inactive"),
    phone: Joi.string().max(30).allow(""),
    description: Joi.string().max(2000).allow("")
  }).min(1)
);
export const changePassword = validateBody(
  Joi.object({
    password: Joi.string().required(),
    newPassword: password,
    confirmPassword: Joi.valid(Joi.ref("newPassword")).required()
  })
);
export const forgotPassword = validateBody(Joi.object({ email }));
export const resetPassword = validateBody(
  Joi.object({
    token: Joi.string()
      .pattern(/^[A-Za-z0-9_-]{43}$/)
      .required(),
    password,
    confirmPassword: Joi.valid(Joi.ref("password")).required()
  })
);

export const listAccounts = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = Joi.object({
    page: Joi.number().integer().min(1).max(100000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    keyword: Joi.string().max(100).allow("").default(""),
    status: Joi.string().valid("initial", "active", "inactive")
  }).validate(req.query);
  if (error) {
    res.status(400).json({ code: "error", message: error.details[0].message });
    return;
  }
  res.locals.accountQuery = value;
  next();
};
