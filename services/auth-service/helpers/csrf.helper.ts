import { createHmac } from "node:crypto";
import { getJwtSecret } from "../config/jwt.config";

/** Gắn CSRF token với jti của JWT mà không lưu session database. */
export const createCsrfToken = (tokenId: string) => {
  return createHmac("sha256", getJwtSecret())
    .update("csrf:" + tokenId)
    .digest("base64url");
};
