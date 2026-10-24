import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token ng?u nhi?n; database ch? l?u gi? tr? b?m. */
export const createToken = () => randomBytes(32).toString("base64url");

/** B?m token c? entropy cao; kh?ng d?ng ?? b?m m?t kh?u. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** So s?nh secret m? kh?ng ph? thu?c n?i dung t?ng k? t?. */
export const compareSecret = (value: string, expected: string) => {
  return timingSafeEqual(Buffer.from(hashToken(value)), Buffer.from(hashToken(expected)));
};
