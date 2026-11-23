import { Request } from "express";

/** Metadata hiển thị, không phải danh tính thiết bị hay bằng chứng quyền truy cập. */
export const requestMetadata = (req: Request) => ({
  ip: (req.ip || "").slice(0, 64),
  userAgent: (req.get("user-agent") || "").slice(0, 512)
});

/** Metadata kỹ thuật đã giới hạn độ dài trước khi lưu vào session/audit. */
export interface RequestMetadata {
  ip: string;
  userAgent: string;
}
