import { Response } from "express";
import { AccountRequest } from "../../interfaces/request.interface";
import { AuthService } from "../../services/auth.service";
import { errorResponse } from "../../helpers/error.helper";

const cookieName = () => "tokenAdmin";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/"
});

/** Đăng nhập và lưu token vào cookie HttpOnly. */
export const loginPost = async (req: AccountRequest, res: Response) => {
  try {
    const { email, password, rememberPassword } = req.body;
    const result = await AuthService.login(email, password, rememberPassword);

    req.adminId = result.userId;
    res.cookie(cookieName(), result.token, { ...cookieOptions(), maxAge: result.maxAge });
    res.json({ code: "success", message: "Đăng nhập thành công!", csrfToken: result.csrfToken });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const logoutPost = async (req: AccountRequest, res: Response) => {
  try {
    res.clearCookie(cookieName(), cookieOptions());
    res.json({ code: "success", message: "Đăng xuất thành công!" });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const profileGet = async (req: AccountRequest, res: Response) => {
  const { id, email, fullName, platformRole, isSuperAdmin } = req.accountUser!;
  res.json({
    code: "success",
    message: "Lấy tài khoản thành công!",
    account: { id, email, fullName, platformRole, isSuperAdmin: isSuperAdmin === true }
  });
};

export const csrfGet = async (req: AccountRequest, res: Response) => {
  try {
    const csrfToken = await AuthService.getCsrfToken(req.accountUser!);
    res.json({ code: "success", csrfToken });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const changePasswordPost = async (req: AccountRequest, res: Response) => {
  try {
    await AuthService.changePassword(req.accountUser!, req.body.password, req.body.newPassword);
    res.clearCookie(cookieName(), cookieOptions());
    res.json({ code: "success", message: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại." });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const forgotPasswordPost = async (req: AccountRequest, res: Response) => {
  try {
    await AuthService.forgotPassword(req.body.email);
    res.json({ code: "success", message: "Nếu email hợp lệ, hướng dẫn sẽ được gửi!" });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const resetPasswordPost = async (req: AccountRequest, res: Response) => {
  try {
    await AuthService.resetPassword(req.body.token, req.body.password);
    res.clearCookie(cookieName(), cookieOptions());
    res.json({ code: "success", message: "Đặt lại mật khẩu thành công!" });
  } catch (error) {
    errorResponse(res, error);
  }
};
