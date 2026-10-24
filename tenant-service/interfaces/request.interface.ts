import { Request } from "express";

/** Danh tính được xác minh bởi Auth; role tenant được kiểm tra riêng. */
export interface AccountIdentity {
  id: string;
  email: string;
  fullName: string;
  platformRole: "user" | "platform_admin";
  isSuperAdmin?: boolean;
  tokenId: string;
  csrfHash: string;
}

export interface AccountRequest extends Request {
  adminId?: string;
  userId?: string;
  accountUser?: AccountIdentity;
  tenantId?: string;
  tenantRole?: string;
}
