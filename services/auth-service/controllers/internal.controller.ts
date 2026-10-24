import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwt.config";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthService } from "../services/auth.service";
import { AccountService } from "../services/account.service";
import { errorResponse, ServiceError } from "../helpers/error.helper";

export const introspect = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.tokenAdmin;
    if (typeof token !== "string") throw new ServiceError("Vui lòng đăng nhập!", 401);
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    const account = await AuthService.getIdentity(decoded);
    res.json({ code: "success", account });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ code: "error", message: "Token không hợp lệ hoặc đã hết hạn!" });
      return;
    }
    errorResponse(res, error);
  }
};

export const lookupAccount = async (req: Request, res: Response) => {
  try {
    if (typeof req.body.userId !== "string" || !mongoose.Types.ObjectId.isValid(req.body.userId))
      throw new ServiceError("ID tài khoản không hợp lệ!");
    const account = await AccountService.getAccountById(req.body.userId);
    if (account.status !== "active") throw new ServiceError("Tài khoản không hoạt động!", 404);
    res.json({
      code: "success",
      account: { id: account.id, email: account.email, fullName: account.fullName }
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const provisionAccount = async (req: Request, res: Response) => {
  try {
    const account = await AuthService.provisionAccount(req.body.email);
    res.json({ code: "success", account });
  } catch (error) {
    errorResponse(res, error);
  }
};
