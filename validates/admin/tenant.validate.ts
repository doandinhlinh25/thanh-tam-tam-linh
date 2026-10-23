import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createTenant = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string().required().messages({
      "string.empty": "Vui lòng nhập tên Tenant / Trường học!",
      "any.required": "Tên Tenant / Trường học là bắt buộc!"
    }),
    code: Joi.string().alphanum().min(2).max(30).optional().messages({
      "string.alphanum": "Mã Tenant chỉ chứa ký tự chữ và số!",
      "string.min": "Mã Tenant tối thiểu 2 ký tự!",
      "string.max": "Mã Tenant tối đa 30 ký tự!"
    }),
    domain: Joi.string().allow("", null),
    description: Joi.string().allow("", null),
    logo: Joi.string().allow("", null),
    plan: Joi.string().valid("free", "pro", "enterprise").default("free"),
    quota: Joi.object({
      maxUsers: Joi.number().min(1),
      maxStorageMB: Joi.number().min(10),
      maxCourses: Joi.number().min(1),
      maxDailyChats: Joi.number().min(1)
    }).optional(),
    ownerId: Joi.string().allow("", null)
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.json({
      code: "error",
      message: error.details[0].message
    });
    return;
  }

  next();
};

export const editTenant = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string().optional(),
    domain: Joi.string().allow("", null),
    description: Joi.string().allow("", null),
    logo: Joi.string().allow("", null),
    plan: Joi.string().valid("free", "pro", "enterprise").optional(),
    quota: Joi.object({
      maxUsers: Joi.number().min(1),
      maxStorageMB: Joi.number().min(10),
      maxCourses: Joi.number().min(1),
      maxDailyChats: Joi.number().min(1)
    }).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.json({
      code: "error",
      message: error.details[0].message
    });
    return;
  }

  next();
};
