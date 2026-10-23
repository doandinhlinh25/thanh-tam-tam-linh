import { Request } from 'express';

export interface AccountRequest extends Request {
  adminId?: String,
  userId?: String,
  accountUser?: any,
}
