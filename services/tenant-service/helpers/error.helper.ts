import { Response } from "express";

/** Lỗi nghiệp vụ được phép trả về cho client. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** Không trả stack trace hoặc thông tin kết nối database. */
export const errorResponse = (res: Response, error: unknown) => {
  const details = error as { code?: number; name?: string; type?: string };
  if (error instanceof ServiceError) {
    res.status(error.status).json({ code: "error", message: error.message });
    return;
  }
  if (details?.code === 11000) {
    res.status(409).json({ code: "error", message: "Dữ liệu đã tồn tại!" });
    return;
  }
  if (
    ["ValidationError", "CastError", "MulterError"].includes(details?.name || "") ||
    details?.type === "entity.parse.failed"
  ) {
    res.status(400).json({ code: "error", message: "Dữ liệu không hợp lệ!" });
    return;
  }
  if (details?.type === "entity.too.large") {
    res.status(413).json({ code: "error", message: "Dữ liệu vượt quá kích thước cho phép!" });
    return;
  }
  res.status(500).json({ code: "error", message: "Lỗi máy chủ!" });
};
