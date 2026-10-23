import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createCourse = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    code: Joi.string().required().trim().messages({
      "string.empty": "Vui lòng nhập mã môn học (ví dụ: CS101)!",
      "any.required": "Mã môn học là bắt buộc!"
    }),
    name: Joi.string().required().trim().messages({
      "string.empty": "Vui lòng nhập tên môn học!",
      "any.required": "Tên môn học là bắt buộc!"
    }),
    description: Joi.string().allow("", null),
    status: Joi.string().valid("active", "draft", "archived").default("active")
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

export const editCourse = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().allow("", null),
    status: Joi.string().valid("active", "draft", "archived").optional()
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

export const assignLecturer = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    userId: Joi.string().required().messages({
      "string.empty": "Vui lòng chọn giảng viên!",
      "any.required": "ID giảng viên là bắt buộc!"
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

export const enrollStudent = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    userId: Joi.string().required().messages({
      "string.empty": "Vui lòng chọn sinh viên / học viên!",
      "any.required": "ID sinh viên là bắt buộc!"
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
