import bcrypt from "bcryptjs";
import argon2 from "argon2";
import { ServiceError } from "./error.helper";

const BCRYPT_ROUNDS = 10;
const BCRYPT_MAX_BYTES = 72;
const dummyHash = bcrypt.hash("invalid-account-password", BCRYPT_ROUNDS);

/** Bcrypt theo duy-tam; từ chối password bị bcrypt cắt ở byte thứ 72. */
export const hashPassword = async (password: string) => {
  if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    throw new ServiceError("Mật khẩu không được vượt quá 72 byte UTF-8!");
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

/** Giữ tương thích cả bcrypt lẫn tài khoản Argon2 đã tạo trước đây. */
export const verifyPassword = async (password: string, encoded?: string) => {
  if (!encoded) {
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  try {
    if (/^\$2[aby]\$/.test(encoded)) {
      return (
        Buffer.byteLength(password, "utf8") <= BCRYPT_MAX_BYTES &&
        (await bcrypt.compare(password, encoded))
      );
    }
    if (encoded.startsWith("$argon2")) return await argon2.verify(encoded, password);
    return false;
  } catch {
    return false;
  }
};
