import { getJwtSecret } from "./jwt.config";
import { createHmac } from "node:crypto";
import Joi from "joi";
import { ServiceError } from "../helpers/error.helper";

/** Super Admin được cấu hình trong .env, không lưu thành AccountAdmin trong MongoDB. */
export const getSuperAdminConfig = () => {
  const values = {
    id: process.env.SUPER_ADMIN_ID,
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD
  };

  // Để trống cả ba biến sẽ tắt đăng nhập bằng Super Admin.
  if (!values.id && !values.email && !values.password) return null;

  const { error, value } = Joi.object({
    id: Joi.string().trim().lowercase().hex().length(24).required(),
    email: Joi.string().trim().lowercase().email().max(254).required(),
    password: Joi.string().min(1).max(128).required()
  }).validate(values);

  if (error) {
    throw new ServiceError(
      "Cần cấu hình đủ SUPER_ADMIN_ID, SUPER_ADMIN_EMAIL và SUPER_ADMIN_PASSWORD hợp lệ!",
      500
    );
  }

  return value as { id: string; email: string; password: string };
};

/** Ràng buộc JWT với cấu hình hiện hành; thay thông tin .env sẽ vô hiệu phiên cũ. */
export const getSuperAdminConfigHash = (config: {
  id: string;
  email: string;
  password: string;
}) => {
  return createHmac("sha256", getJwtSecret())
    .update(JSON.stringify([config.id, config.email, config.password]))
    .digest("hex");
};
