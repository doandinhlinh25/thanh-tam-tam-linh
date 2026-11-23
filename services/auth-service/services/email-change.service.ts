import slugify from "slugify";
import AccountAdmin from "../models/account-admin.model";
import EmailChangeToken from "../models/email-change-token.model";
import ActionToken from "../models/action-token.model";
import { AuthSecurityRepository } from "../repositories/auth-security.repository";
import { AccountIdentity } from "../interfaces/request.interface";
import { authFeature } from "../configs/auth-feature.config";
import { getSuperAdminConfig } from "../config/super-admin.config";
import { createToken, hashToken } from "../helpers/token.helper";
import { sendMail } from "../helpers/mail.helper";
import { ServiceError } from "../helpers/error.helper";
import { MfaService, MfaProof } from "./mfa.service";
import { SessionService } from "./session.service";

/** Thay email chỉ sau token một lần, reauth và unique check trong transaction. */
export class EmailChangeService {
  private static unavailable() {
    return new ServiceError("Không thể sử dụng email này!", 409, "EMAIL_UNAVAILABLE");
  }
  private static checkUser(identity: AccountIdentity) {
    if (identity.isSuperAdmin)
      throw new ServiceError("Email Super Admin được quản lý trong .env!", 403, "FORBIDDEN");
  }

  /** Lưu token hash trước SMTP; lỗi gửi không đổi email account. */
  static async request(
    identity: AccountIdentity,
    targetEmail: string,
    password: string,
    proof: MfaProof
  ) {
    this.checkUser(identity);
    const token = createToken();
    await AuthSecurityRepository.run(identity.id, async (state, session) => {
      const principal = await MfaService.reauthenticate(identity, state, session, password, proof);
      if (
        targetEmail === principal.email ||
        targetEmail === getSuperAdminConfig()?.email ||
        (await AccountAdmin.exists({ email: targetEmail }).session(session))
      )
        throw this.unavailable();
      await EmailChangeToken.findOneAndUpdate(
        { userId: identity.id },
        {
          $set: {
            tokenHash: hashToken(token),
            targetEmail,
            securityVersion: state.version,
            consumedAt: null,
            expiresAt: new Date(Date.now() + authFeature.emailChangeMs)
          }
        },
        { upsert: true, session }
      );
    });
    try {
      await sendMail(
        targetEmail,
        "Xác minh thay đổi email",
        [process.env.APP_URL, "/change-email#token=", token].join("")
      );
    } catch {
      await EmailChangeToken.updateOne(
        { userId: identity.id, tokenHash: hashToken(token) },
        { consumedAt: new Date() }
      );
      throw new ServiceError(
        "Chưa thể gửi email, vui lòng thử lại!",
        503,
        "AUTH_DEPENDENCY_UNAVAILABLE"
      );
    }
  }

  /** Tiêu thụ token cùng user và đổi email unique, thu hồi phiên trong transaction. */
  static async confirm(
    identity: AccountIdentity,
    token: string,
    password: string,
    proof: MfaProof
  ) {
    this.checkUser(identity);
    try {
      await AuthSecurityRepository.run(identity.id, async (state, session) => {
        const principal = await MfaService.reauthenticate(
          identity,
          state,
          session,
          password,
          proof
        );
        const action = await EmailChangeToken.findOneAndUpdate(
          {
            userId: identity.id,
            tokenHash: hashToken(token),
            securityVersion: state.version,
            consumedAt: null,
            expiresAt: { $gt: new Date() }
          },
          { consumedAt: new Date() },
          { new: true, session }
        );
        if (!action)
          throw new ServiceError(
            "Token không hợp lệ hoặc hết hạn!",
            400,
            "TOKEN_INVALID_OR_EXPIRED"
          );
        if (action.targetEmail === getSuperAdminConfig()?.email) throw this.unavailable();
        await AccountAdmin.updateOne(
          { _id: identity.id, status: "active", deleted: false },
          {
            $set: {
              email: action.targetEmail,
              emailVerifiedAt: new Date(),
              search: slugify([principal.fullName, action.targetEmail].join(" "), {
                lower: true,
                replacement: " "
              })
            },
            $inc: { authVersion: 1 }
          },
          { session, runValidators: true }
        );
        await ActionToken.updateMany(
          { userId: identity.id, consumedAt: null },
          { consumedAt: new Date() },
          { session }
        );
        await SessionService.invalidate(identity.id, state, session);
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw this.unavailable();
      throw error;
    }
  }
}
