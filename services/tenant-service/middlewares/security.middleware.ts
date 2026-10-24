import { NextFunction, Response } from "express";
import mongoose from "mongoose";
import { AccountRequest } from "../interfaces/request.interface";
import { compareSecret, hashToken } from "../helpers/token.helper";

const rateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, expires: 0 }
});
const RateLimit = mongoose.model("RateLimit", rateLimitSchema, "rate_limits");

/** Cả login và các thao tác ghi của browser đều cần Origin được cấu hình. */
export const verifyOrigin = (req: AccountRequest, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim());
  if (!allowedOrigins.includes(req.get("origin") || "")) {
    res.status(403).json({ code: "error", message: "Origin không được phép!" });
    return;
  }

  next();
};

/** CSRF token phải gắn với JWT đã được xác minh. */
export const verifyCsrf = (req: AccountRequest, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const token = req.get("x-csrf-token");
  if (!token || !req.accountUser || !compareSecret(hashToken(token), req.accountUser.csrfHash)) {
    res.status(403).json({ code: "error", message: "CSRF token không hợp lệ!" });
    return;
  }

  next();
};

/** Rate limit dùng counter atomic, chia sẻ được giữa các instance. */
export const rateLimit = (scope: string, limit: number, seconds: number) => {
  return async (req: AccountRequest, res: Response, next: NextFunction) => {
    try {
      const window = Math.floor(Date.now() / (seconds * 1000));
      const subjects = [req.ip || "unknown"];
      if (typeof req.body?.email === "string") {
        subjects.push(req.body.email.trim().toLowerCase());
      }

      const counters = await Promise.all(
        subjects.map((subject) => {
          const key = [scope, hashToken(subject), window].join(":");
          return RateLimit.findOneAndUpdate(
            { key },
            {
              $inc: { count: 1 },
              $setOnInsert: { expiresAt: new Date((window + 2) * seconds * 1000) }
            },
            { upsert: true, new: true }
          );
        })
      );

      if (counters.some((counter) => counter.count > limit)) {
        res.setHeader("Retry-After", String(seconds));
        res
          .status(429)
          .json({ code: "error", message: "Quá nhiều yêu cầu, vui lòng thử lại sau!" });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/** Chỉ endpoint nội bộ được gọi bằng service credential riêng. */
export const verifyService = (secretName: string) => {
  return (req: AccountRequest, res: Response, next: NextFunction) => {
    const secret = process.env[secretName];
    if (
      !secret ||
      secret.length < 32 ||
      !compareSecret(req.get("authorization") || "", "Bearer " + secret)
    ) {
      res.status(401).json({ code: "error", message: "Service chưa được xác thực!" });
      return;
    }

    next();
  };
};
