import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const addMember = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    userId: Joi.string().required().messages({
      "string.empty": "Vui lòng chọn người dùng!",
      "any.required": "ID người dùng là bắt buộc!"
    }),
    role: Joi.string()
      .valid("tenant_owner", "tenant_admin", "lecturer", "student")
      .required()
      .messages({
        "any.only": "Vai trò phải là một trong các giá trị: tenant_owner, tenant_admin, lecturer, student",
        "any.required": "Vui lòng chọn vai trò!"
      })
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

export const updateRole = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    role: Joi.string()
      .valid("tenant_owner", "tenant_admin", "lecturer", "student")
      .required()
      .messages({
        "any.only": "Vai trò phải là một trong các giá trị: tenant_owner, tenant_admin, lecturer, student",
        "any.required": "Vui lòng chọn vai trò mới!"
      })
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

export const createInvitation = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email không hợp lệ!",
      "string.empty": "Vui lòng nhập email!",
      "any.required": "Email là bắt buộc!"
    }),
    role: Joi.string()
      .valid("tenant_owner", "tenant_admin", "lecturer", "student")
      .required()
      .messages({
        "any.only": "Vai trò phải là một trong các giá trị: tenant_owner, tenant_admin, lecturer, student",
        "any.required": "Vui lòng chọn vai trò cho lời mời!"
      })
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

export const acceptInvitation = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    token: Joi.string().required().messages({
      "string.empty": "Vui lòng cung cấp mã token lời mời!",
      "any.required": "Token lời mời là bắt buộc!"
    })
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
