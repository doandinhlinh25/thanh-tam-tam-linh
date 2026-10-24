import { Request, Response, NextFunction, Router } from "express";
import Joi from "joi";

/** Chuẩn hóa dữ liệu trước khi controller đọc request body. */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.required().validate(req.body, { allowUnknown: false });
    if (error) {
      res.status(400).json({ code: "error", message: error.details[0].message });
      return;
    }
    req.body = value;
    next();
  };
};

/** ID trên URL phải là ObjectId đầy đủ. */
export const validateParams = (router: Router) => {
  for (const name of ["id", "tenantId", "memberId", "invitationId", "courseId", "userId"]) {
    router.param(name, (_req, res, next, value) => {
      if (!/^[a-fA-F0-9]{24}$/.test(value)) {
        res.status(400).json({ code: "error", message: "ID không hợp lệ!" });
        return;
      }
      next();
    });
  }
};

/** Chỉ tái sử dụng định dạng, không chia sẻ domain model giữa các service. */
export const objectId = Joi.string().hex().length(24);
