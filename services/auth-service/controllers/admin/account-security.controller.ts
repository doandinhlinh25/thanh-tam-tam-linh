import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AuthChallenge from "../../models/auth-challenge.model";
import { AccountRequest } from "../../interfaces/request.interface";
import { AuthService } from "../../services/auth.service";
import { SessionService, IssuedSession } from "../../services/session.service";
import { MfaService } from "../../services/mfa.service";
import { ProfileService } from "../../services/profile.service";
import { EmailChangeService } from "../../services/email-change.service";
import { LoginHistoryService } from "../../services/login-history.service";
import { requestMetadata } from "../../helpers/request-metadata.helper";
import { errorResponse, ServiceError } from "../../helpers/error.helper";
import { hashToken } from "../../helpers/token.helper";
import { getJwtSecret } from "../../config/jwt.config";
import { verifyCsrf } from "../../middlewares/security.middleware";
import { AuthFeatureResponse } from "../../dto/response/auth-features.response";

/** Cookie options duy nhất cho login, rotate và clear. */
export const accountCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/"
});

/** Ghi cookie chỉ sau khi service trả kết quả transaction thành công. */
export const writeSessionCookie = (res: Response, issued: IssuedSession) => {
  res.cookie("tokenAdmin", issued.token, { ...accountCookieOptions(), maxAge: issued.maxAge });
};

/** Logout invalid-cookie vẫn clear; phiên hợp lệ bắt buộc session-bound CSRF. */
export const logoutGuard = async (req: AccountRequest, res: Response, next: NextFunction) => {
  try {
    if (typeof req.cookies.tokenAdmin !== "string") {
      next();
      return;
    }
    req.accountUser = await AuthService.getIdentity(
      jwt.verify(req.cookies.tokenAdmin, getJwtSecret(), { algorithms: ["HS256"] })
    );
    verifyCsrf(req, res, next);
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      (error instanceof ServiceError && error.status === 401)
    ) {
      delete req.accountUser;
      next();
      return;
    }
    errorResponse(res, error);
  }
};

/** Nhận user rate key chỉ từ record challenge do server tạo, không phải userId request. */
export const challengeRateSubject = async (
  req: AccountRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const challenge = await AuthChallenge.findOne({
      tokenHash: hashToken(req.body.challengeToken),
      purpose: "login"
    }).select("userId");
    if (challenge) res.locals.authRateSubject = String(challenge.userId);
    next();
  } catch (error) {
    errorResponse(res, error);
  }
};

type Operation = (req: AccountRequest, res: Response) => Promise<void>;
const handle = (operation: Operation) => async (req: AccountRequest, res: Response) => {
  try {
    await operation(req, res);
  } catch (error) {
    errorResponse(res, error);
  }
};
const sendData = <T>(res: Response, data: T) =>
  res.json({ code: "success", data } satisfies AuthFeatureResponse<T>);

/** Hoàn tất factor thứ hai; không nhận rememberPassword/identity từ client. */
export const loginFactor = handle(async (req, res) => {
  const issued = await MfaService.completeLogin(
    req.body.challengeToken,
    req.body,
    requestMetadata(req)
  );
  writeSessionCookie(res, issued);
  res.json({ code: "success", message: "Đăng nhập thành công!", csrfToken: issued.csrfToken });
});
/** Danh sách phiên active của chính người gọi. */
export const sessions = handle(async (req, res) => {
  const { page, limit } = res.locals.authQuery;
  sendData(res, await SessionService.list(req.accountUser!, page, limit));
});
/** Thu hồi một phiên thuộc người gọi. */
export const revokeSession = handle(async (req, res) => {
  if (await SessionService.revoke(req.accountUser!, String(req.params.sessionId)))
    res.clearCookie("tokenAdmin", accountCookieOptions());
  res.json({ code: "success", message: "Đã thu hồi phiên!" });
});
/** Thu hồi tất cả phiên sau reauthentication. */
export const logoutAll = handle(async (req, res) => {
  await MfaService.logoutAll(req.accountUser!, req.body.password, req.body);
  res.clearCookie("tokenAdmin", accountCookieOptions());
  res.json({ code: "success", message: "Đã đăng xuất tất cả thiết bị!" });
});
/** Cập nhật allowlist hồ sơ tự phục vụ. */
export const profile = handle(async (req, res) => {
  res.json({ code: "success", account: await ProfileService.update(req.accountUser!, req.body) });
});
/** Gửi xác minh tới email mới, chưa thay email account. */
export const requestEmail = handle(async (req, res) => {
  await EmailChangeService.request(
    req.accountUser!,
    req.body.newEmail,
    req.body.password,
    req.body
  );
  res.json({ code: "success", message: "Đã gửi hướng dẫn xác minh email mới!" });
});
/** Xác minh email xong thu hồi phiên và yêu cầu đăng nhập lại. */
export const confirmEmail = handle(async (req, res) => {
  await EmailChangeService.confirm(req.accountUser!, req.body.token, req.body.password, req.body);
  res.clearCookie("tokenAdmin", accountCookieOptions());
  res.json({ code: "success", message: "Đã đổi email, vui lòng đăng nhập lại!" });
});
/** Chỉ trả trạng thái và số recovery codes, không trả secret. */
export const mfaStatus = handle(async (req, res) => {
  sendData(res, await MfaService.status(req.accountUser!.id));
});
/** Setup secret chỉ trả một lần sau reauthentication. */
export const setupMfa = handle(async (req, res) => {
  sendData(res, await MfaService.setup(req.accountUser!, req.body.password));
});
/** Bật MFA, rotate session và trả recovery codes một lần. */
export const enableMfa = handle(async (req, res) => {
  const result = await MfaService.enable(
    req.accountUser!,
    req.body.setupToken,
    req.body.otp,
    requestMetadata(req)
  );
  writeSessionCookie(res, result);
  res.json({
    code: "success",
    csrfToken: result.csrfToken,
    data: { recoveryCodes: result.recoveryCodes }
  });
});
/** Tắt MFA bằng password và factor hiện hành rồi thu hồi mọi phiên. */
export const disableMfa = handle(async (req, res) => {
  await MfaService.change(
    req.accountUser!,
    req.body.password,
    req.body,
    false,
    requestMetadata(req)
  );
  res.clearCookie("tokenAdmin", accountCookieOptions());
  res.json({ code: "success", message: "Đã tắt 2FA, vui lòng đăng nhập lại!" });
});
/** Tạo recovery codes mới, vô hiệu toàn bộ codes và phiên cũ. */
export const regenerateRecovery = handle(async (req, res) => {
  const result = await MfaService.change(
    req.accountUser!,
    req.body.password,
    req.body,
    true,
    requestMetadata(req)
  );
  if (!result) throw new Error("Missing rotated session");
  writeSessionCookie(res, result);
  res.json({
    code: "success",
    csrfToken: result.csrfToken,
    data: { recoveryCodes: result.recoveryCodes }
  });
});
/** Lịch sử login được scope bằng danh tính session, không bằng query userId. */
export const history = handle(async (req, res) => {
  const { page, limit, outcome } = res.locals.authQuery;
  sendData(res, await LoginHistoryService.list(req.accountUser!.id, page, limit, outcome));
});
