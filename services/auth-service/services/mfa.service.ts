import { randomBytes } from "node:crypto";
import { ClientSession } from "mongoose";
import * as OTPAuth from "otpauth";
import AccountAdmin from "../models/account-admin.model";
import AuthSecurity from "../models/auth-security.model";
import AuthChallenge from "../models/auth-challenge.model";
import { AuthSecurityRepository, SecurityState } from "../repositories/auth-security.repository";
import { SessionService, AuthPrincipal } from "./session.service";
import { LoginHistoryService } from "./login-history.service";
import { AccountIdentity } from "../interfaces/request.interface";
import { RequestMetadata } from "../helpers/request-metadata.helper";
import { ServiceError } from "../helpers/error.helper";
import { createToken, hashToken } from "../helpers/token.helper";
import { verifyPassword } from "../helpers/password.helper";
import { encryptMfaSecret, decryptMfaSecret, getMfaConfig } from "../helpers/mfa-crypto.helper";
import { getSuperAdminConfig } from "../config/super-admin.config";
import { authFeature } from "../configs/auth-feature.config";

/** Bằng chứng factor thứ hai, chỉ nhận đúng một loại mỗi lần. */
export interface MfaProof {
  otp?: string;
  recoveryCode?: string;
}

/** TOTP/recovery dùng chung cho login và thao tác nhạy cảm, không có admin bypass. */
export class MfaService {
  /** Cấu hình TOTP cho app Authenticator; không tự cài thuật toán mật mã. */
  static totp(secret: string, label = "account") {
    return new OTPAuth.TOTP({
      issuer: getMfaConfig().issuer,
      label,
      algorithm: "SHA1",
      digits: 6,
      period: authFeature.otpPeriod,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
  }

  /** Trả time step khớp trong window hoặc null; chưa tiêu thụ OTP. */
  static step(secret: string, otp: string | undefined) {
    if (!otp || !/^\d{6}$/.test(otp)) return null;
    const timestamp = Date.now();
    const delta = this.totp(secret).validate({
      token: otp,
      timestamp,
      window: authFeature.otpWindow
    });
    return delta === null ? null : Math.floor(timestamp / (authFeature.otpPeriod * 1000)) + delta;
  }

  /** Tiêu thụ factor một lần dưới lock, commit cùng thao tác nghiệp vụ. */
  static async consumeFactor(
    userId: string,
    state: SecurityState,
    proof: MfaProof,
    session: ClientSession
  ) {
    getMfaConfig();
    if (!!proof.otp === !!proof.recoveryCode) return false;
    if (proof.recoveryCode) {
      const codeHash = hashToken(proof.recoveryCode);
      if (!state.recoveryHashes.includes(codeHash)) return false;
      state.recoveryHashes = state.recoveryHashes.filter((item) => item !== codeHash);
    } else {
      const secret = decryptMfaSecret(state.encryptedSecret || "", userId, "active");
      const step = this.step(secret, proof.otp);
      if (step === null || step <= state.lastAcceptedStep) return false;
      state.lastAcceptedStep = step;
    }
    await state.save({ session });
    return true;
  }

  /** Xác minh phiên/password và factor khi bật MFA; không có admin bypass. */
  static async reauthenticate(
    identity: AccountIdentity,
    state: SecurityState,
    session: ClientSession,
    password: string,
    proof: MfaProof
  ) {
    const { principal } = await SessionService.assertCurrent(identity, state, session);
    if (
      !(await SessionService.passwordValid(principal, password)) ||
      (state.mfaEnabled && !(await this.consumeFactor(identity.id, state, proof, session)))
    )
      throw new ServiceError("Không thể xác minh tài khoản!", 401, "REAUTHENTICATION_FAILED");
    return principal;
  }

  /** Password đúng chỉ tạo challenge nếu bật MFA, chưa cấp JWT. */
  static async beginLogin(
    email: string,
    password: string,
    rememberPassword: boolean,
    metadata: RequestMetadata
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const superAdmin = getSuperAdminConfig();
    const account = await AccountAdmin.findOne({ email: normalizedEmail, deleted: false });
    const userId = normalizedEmail === superAdmin?.email ? superAdmin.id : account?.id;
    if (!userId) {
      await verifyPassword(password, undefined);
      await LoginHistoryService.record(null, "denied", "password", metadata, "CREDENTIALS_INVALID");
      throw new ServiceError("Email hoặc mật khẩu không chính xác!", 401);
    }
    const result = await AuthSecurityRepository.run(userId, async (state, session) => {
      let principal: AuthPrincipal;
      try {
        principal = await SessionService.principal(userId, session);
      } catch (error) {
        if (error instanceof ServiceError && error.status === 401) return { denied: true as const };
        throw error;
      }
      if (
        principal.email !== normalizedEmail ||
        !(await SessionService.passwordValid(principal, password))
      )
        return { denied: true as const };
      if (state.mfaEnabled) {
        getMfaConfig();
        const challengeToken = createToken();
        await AuthChallenge.create(
          [
            {
              userId,
              tokenHash: hashToken(challengeToken),
              purpose: "login",
              securityVersion: state.version,
              authVersion: principal.authVersion,
              credentialBinding: principal.binding,
              rememberPassword,
              expiresAt: new Date(Date.now() + authFeature.challengeMs)
            }
          ],
          { session }
        );
        return {
          mfaRequired: true as const,
          challengeToken,
          expiresIn: authFeature.challengeMs / 1000
        };
      }
      const issued = await SessionService.issue(
        principal,
        state,
        rememberPassword,
        metadata,
        session
      );
      if (!principal.isSuperAdmin)
        await AccountAdmin.updateOne({ _id: userId }, { lastLoginAt: new Date() }, { session });
      await LoginHistoryService.record(userId, "success", "password", metadata, "", session);
      return { mfaRequired: false as const, ...issued };
    });
    if ("denied" in result) {
      await LoginHistoryService.record(
        userId,
        "denied",
        "password",
        metadata,
        "CREDENTIALS_INVALID"
      );
      throw new ServiceError("Email hoặc mật khẩu không chính xác!", 401);
    }
    return result;
  }

  /** Atomic consume challenge/factor và cấp session; lỗi OTP vẫn commit số lần thử. */
  static async completeLogin(challengeToken: string, proof: MfaProof, metadata: RequestMetadata) {
    const found = await AuthChallenge.findOne({
      tokenHash: hashToken(challengeToken),
      purpose: "login"
    });
    if (!found) throw this.challengeError();
    const result = await AuthSecurityRepository.run(
      String(found.userId),
      async (state, session) => {
        const challenge = await AuthChallenge.findOneAndUpdate(
          {
            _id: found._id,
            purpose: "login",
            consumedAt: null,
            expiresAt: { $gt: new Date() },
            attemptCount: { $lt: authFeature.maxAttempts }
          },
          { $inc: { attemptCount: 1 } },
          { new: true, session }
        ).select("+credentialBinding");
        if (!challenge) return null;
        let principal: AuthPrincipal;
        try {
          principal = await SessionService.principal(String(found.userId), session);
        } catch (error) {
          if (error instanceof ServiceError && error.status === 401) return null;
          throw error;
        }
        if (
          !state.mfaEnabled ||
          challenge.securityVersion !== state.version ||
          challenge.authVersion !== principal.authVersion ||
          challenge.credentialBinding !== principal.binding ||
          !(await this.consumeFactor(principal.id, state, proof, session))
        ) {
          await LoginHistoryService.record(
            principal.id,
            "denied",
            "mfa",
            metadata,
            "MFA_CHALLENGE_INVALID",
            session
          );
          return null;
        }
        challenge.consumedAt = new Date();
        await challenge.save({ session });
        const issued = await SessionService.issue(
          principal,
          state,
          challenge.rememberPassword,
          metadata,
          session
        );
        if (!principal.isSuperAdmin)
          await AccountAdmin.updateOne(
            { _id: principal.id },
            { lastLoginAt: new Date() },
            { session }
          );
        await LoginHistoryService.record(
          principal.id,
          "success",
          proof.recoveryCode ? "recovery" : "mfa",
          metadata,
          "",
          session
        );
        return issued;
      }
    );
    if (!result) throw this.challengeError();
    return result;
  }

  private static challengeError() {
    return new ServiceError("Không thể xác minh đăng nhập!", 401, "MFA_CHALLENGE_INVALID");
  }

  /** Trả trạng thái hiển thị, không xuất secret hay recovery hash. */
  static async status(userId: string) {
    const state = await AuthSecurity.findOne({ userId }).select("+recoveryHashes");
    return {
      enabled: state?.mfaEnabled === true,
      recoveryCodesRemaining: state?.recoveryHashes.length || 0
    };
  }

  /** Tạo enrollment pending ràng buộc phiên hiện tại, chưa bật MFA. */
  static async setup(identity: AccountIdentity, password: string) {
    return AuthSecurityRepository.run(identity.id, async (state, session) => {
      if (state.mfaEnabled) throw new ServiceError("2FA đã được bật!", 409, "MFA_STATE_CONFLICT");
      const principal = await this.reauthenticate(identity, state, session, password, {});
      const secret = new OTPAuth.Secret({ size: 20 }).base32;
      const setupToken = createToken();
      await AuthChallenge.updateMany(
        { userId: identity.id, purpose: "enroll", consumedAt: null },
        { consumedAt: new Date() },
        { session }
      );
      const { record } = await SessionService.assertCurrent(identity, state, session);
      await AuthChallenge.create(
        [
          {
            userId: identity.id,
            purpose: "enroll",
            tokenHash: hashToken(setupToken),
            securityVersion: state.version,
            authVersion: principal.authVersion,
            credentialBinding: principal.binding,
            sessionId: record._id,
            encryptedSecret: encryptMfaSecret(secret, identity.id, "pending"),
            expiresAt: new Date(Date.now() + authFeature.enrollmentMs)
          }
        ],
        { session }
      );
      return {
        setupToken,
        secret,
        otpauthUri: this.totp(secret, principal.email).toString(),
        expiresIn: authFeature.enrollmentMs / 1000
      };
    });
  }

  /** Sinh codes entropy 128-bit, chỉ trả bản thô tại thời điểm cấp. */
  static recoveryCodes() {
    return Array.from({ length: authFeature.recoveryCount }, () =>
      randomBytes(16).toString("base64url")
    );
  }

  /** Xác nhận OTP enrollment, mã hóa secret và thay phiên cũ. */
  static async enable(
    identity: AccountIdentity,
    setupToken: string,
    otp: string,
    metadata: RequestMetadata
  ) {
    const result = await AuthSecurityRepository.run(identity.id, async (state, session) => {
      const { principal, record } = await SessionService.assertCurrent(identity, state, session);
      if (state.mfaEnabled) throw new ServiceError("2FA đã được bật!", 409, "MFA_STATE_CONFLICT");
      const challenge = await AuthChallenge.findOneAndUpdate(
        {
          userId: identity.id,
          tokenHash: hashToken(setupToken),
          purpose: "enroll",
          sessionId: record._id,
          securityVersion: state.version,
          authVersion: principal.authVersion,
          credentialBinding: principal.binding,
          expiresAt: { $gt: new Date() },
          consumedAt: null,
          attemptCount: { $lt: authFeature.maxAttempts }
        },
        { $inc: { attemptCount: 1 } },
        { new: true, session }
      ).select("+encryptedSecret");
      if (!challenge) return null;
      const secret = decryptMfaSecret(challenge.encryptedSecret || "", identity.id, "pending");
      const step = this.step(secret, otp);
      if (step === null) return null;
      const recoveryCodes = this.recoveryCodes();
      state.mfaEnabled = true;
      state.encryptedSecret = encryptMfaSecret(secret, identity.id, "active");
      state.lastAcceptedStep = step;
      state.recoveryHashes = recoveryCodes.map(hashToken);
      await SessionService.invalidate(identity.id, state, session);
      const issued = await SessionService.issue(principal, state, false, metadata, session);
      return { ...issued, recoveryCodes };
    });
    if (!result)
      throw new ServiceError(
        "Token hoặc mã xác minh không hợp lệ!",
        400,
        "TOKEN_INVALID_OR_EXPIRED"
      );
    return result;
  }

  /** Tắt MFA hoặc thay codes sau reauth; revoke rồi mới rotate session. */
  static async change(
    identity: AccountIdentity,
    password: string,
    proof: MfaProof,
    regenerate: boolean,
    metadata: RequestMetadata
  ) {
    return AuthSecurityRepository.run(identity.id, async (state, session) => {
      const principal = await this.reauthenticate(identity, state, session, password, proof);
      if (!state.mfaEnabled)
        throw new ServiceError("2FA chưa được bật!", 409, "MFA_STATE_CONFLICT");
      const recoveryCodes = regenerate ? this.recoveryCodes() : [];
      state.recoveryHashes = recoveryCodes.map(hashToken);
      if (!regenerate) {
        state.mfaEnabled = false;
        state.encryptedSecret = null;
        state.lastAcceptedStep = -1;
      }
      await SessionService.invalidate(identity.id, state, session);
      return regenerate
        ? {
            ...(await SessionService.issue(principal, state, false, metadata, session)),
            recoveryCodes
          }
        : null;
    });
  }

  /** Thu hồi tất cả phiên của principal sau password/factor hợp lệ. */
  static async logoutAll(identity: AccountIdentity, password: string, proof: MfaProof) {
    await AuthSecurityRepository.run(identity.id, async (state, session) => {
      await this.reauthenticate(identity, state, session, password, proof);
      await SessionService.invalidate(identity.id, state, session);
    });
  }
}
