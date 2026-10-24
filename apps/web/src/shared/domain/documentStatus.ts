import type { DocumentStatus } from "./types";

export const statusLabels: Record<DocumentStatus, string> = {
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  failed: "Thất bại",
};
