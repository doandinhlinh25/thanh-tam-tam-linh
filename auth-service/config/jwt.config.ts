import { ServiceError } from "../helpers/error.helper";

/** JWT_SECRET chỉ được lưu ở Auth, không chia sẻ với frontend hay Tenant. */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new ServiceError("JWT_SECRET phải có ít nhất 32 ký tự!", 500);
  return secret;
};
