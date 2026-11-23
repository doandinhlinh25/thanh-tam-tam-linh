import { ClientSession } from "mongoose";
import AuthAudit from "../models/auth-audit.model";
import { RequestMetadata } from "../helpers/request-metadata.helper";

/** Audit riêng của Auth; không lưu nội dung request, password, OTP hoặc token. */
export class LoginHistoryService {
  /** Ghi login outcome/metadata allowlist, không nhận secret hoặc request body. */
  static async record(
    userId: string | null,
    outcome: string,
    method: string,
    metadata: RequestMetadata,
    reasonCode = "",
    session?: ClientSession
  ) {
    await AuthAudit.create(
      [{ userId, action: "login", outcome, method, reasonCode, ...metadata }],
      { session }
    );
  }

  /** Phân trang lịch sử trong retention của đúng người dùng. */
  static async list(userId: string, page: number, limit: number, outcome?: string) {
    const filter = {
      userId,
      action: "login",
      ...(outcome ? { outcome } : {}),
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }]
    };
    const [items, total] = await Promise.all([
      AuthAudit.find(filter)
        .select("_id createdAt outcome method reasonCode ip userAgent")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuthAudit.countDocuments(filter)
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
