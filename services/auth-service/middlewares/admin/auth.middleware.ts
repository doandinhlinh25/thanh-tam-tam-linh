import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AccountRequest } from "../../interfaces/request.interface";
import { AuthService } from "../../services/auth.service";
import { permissionList } from "../../config/variable.config";
import { getJwtSecret } from "../../config/jwt.config";
import { errorResponse } from "../../helpers/error.helper";

/** Xác minh JWT trong cookie theo duy-tam, sau đó kiểm tra tài khoản hiện hành. */
export const verifyToken = async (req: AccountRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.tokenAdmin;
    if (typeof token !== "string") {
      res.status(401).json({ code: "error", message: "Vui lòng đăng nhập!" });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    req.accountUser = await AuthService.getIdentity(decoded);
    req.adminId = req.accountUser.id;
    res.locals.accountAdmin = {
      ...req.accountUser,
      isSuperAdmin: req.accountUser.isSuperAdmin === true
    };

    if (req.accountUser.isSuperAdmin || req.accountUser.platformRole === "platform_admin") {
      res.locals.permissions = permissionList.map((item) => item.id);
    } else {
      res.locals.permissions = [];
    }
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ code: "error", message: "Token không hợp lệ hoặc đã hết hạn!" });
      return;
    }
    errorResponse(res, error);
  }
};

export const checkPermission = (permission: string) => {
  return (_req: AccountRequest, res: Response, next: NextFunction) => {
    if (res.locals.permissions?.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ code: "error", message: "Không đủ quyền!" });
  };
};

export const requirePlatformAdmin = (req: AccountRequest, res: Response, next: NextFunction) => {
  if (req.accountUser?.platformRole !== "platform_admin") {
    res.status(403).json({ code: "error", message: "Không đủ quyền quản trị nền tảng!" });
    return;
  }
  next();
};
