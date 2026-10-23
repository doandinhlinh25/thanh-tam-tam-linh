import { Request } from 'express';

export interface AccountRequest extends Request {
  adminId?: string;
  userId?: string;
  accountUser?: any;
  tenantId?: string;
  tenant?: any;
  tenantRole?: string;
  membership?: any;
}
