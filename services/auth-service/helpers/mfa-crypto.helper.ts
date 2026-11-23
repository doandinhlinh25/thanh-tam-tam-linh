import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ServiceError } from "./error.helper";

/** Kiểm tra key riêng của MFA, không tái sử dụng JWT_SECRET. */
export const getMfaConfig = () => {
  const encoded = process.env.AUTH_MFA_ENCRYPTION_KEY || "";
  const keyId = process.env.AUTH_MFA_KEY_ID || "";
  const issuer = process.env.AUTH_MFA_ISSUER || "";
  const key = Buffer.from(encoded, "base64");
  if (
    key.length !== 32 ||
    key.toString("base64") !== encoded ||
    !/^[\w-]{1,64}$/.test(keyId) ||
    !issuer ||
    issuer.length > 120
  )
    throw new ServiceError("Cấu hình MFA không hợp lệ!", 503, "MFA_CONFIGURATION_INVALID");
  return { key, keyId, issuer };
};

/** Mã hóa secret, gắn ciphertext với principal và mục đích sử dụng. */
export const encryptMfaSecret = (secret: string, userId: string, purpose: string) => {
  const { key, keyId } = getMfaConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from([userId, purpose].join(":")));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    keyId,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
};

/** Sai key/ciphertext là lỗi cấu hình, không được bỏ qua MFA. */
export const decryptMfaSecret = (value: string, userId: string, purpose: string) => {
  const config = getMfaConfig();
  try {
    const [keyId, iv, tag, ciphertext, extra] = value.split(".");
    if (keyId !== config.keyId || extra !== undefined) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", config.key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from([userId, purpose].join(":")));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new ServiceError("Không thể xác minh MFA!", 503, "MFA_CONFIGURATION_INVALID");
  }
};
