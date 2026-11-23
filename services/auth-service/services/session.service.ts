import jwt from "jsonwebtoken";
import { ClientSession } from "mongoose";
import AccountAdmin from "../models/account-admin.model";
import AuthSession from "../models/auth-session.model";
import AuthSecurity from "../models/auth-security.model";
import AuthChallenge from "../models/auth-challenge.model";
import EmailChangeToken from "../models/email-change-token.model";
import { AuthSecurityRepository, SecurityState } from "../repositories/auth-security.repository";
import { getSuperAdminConfig, getSuperAdminConfigHash } from "../config/super-admin.config";
import { getJwtSecret } from "../config/jwt.config";
import { AccountIdentity } from "../interfaces/request.interface";
import { RequestMetadata } from "../helpers/request-metadata.helper";
import { createToken, hashToken, compareSecret } from "../helpers/token.helper";
import { createCsrfToken } from "../helpers/csrf.helper";
import { verifyPassword } from "../helpers/password.helper";
import { ServiceError } from "../helpers/error.helper";
import { authFeature } from "../configs/auth-feature.config";

/** Snapshot credential hiện hành, chỉ dùng trong Auth; không xuất password/binding ra HTTP. */
export interface AuthPrincipal {
  id: string;
  email: string;
  fullName: string;
  platformRole: "user" | "platform_admin";
  isSuperAdmin: boolean;
  authVersion: number;
  binding: string | null;
  password: string;
}

/** Kết quả phát hành cookie sau khi transaction lưu phiên thành công. */
export interface IssuedSession {
  token: string;
  csrfToken: string;
  maxAge: number;
  userId: string;
}

/** Session enforcement dùng chung ở API public và introspection, không cache quyền cũ. */
export class SessionService {
  /** Lỗi phiên dùng chung ở public API và introspection. */
  static invalid() {
    return new ServiceError("Phiên đăng nhập không hợp lệ!", 401, "SESSION_INVALID");
  }

  /** Đọc principal active và credential hiện hành; không lấy quyền từ client. */
  static async principal(userId: string, session?: ClientSession): Promise<AuthPrincipal> {
    const superAdmin = getSuperAdminConfig();
    if (userId === superAdmin?.id)
      return {
        id: userId,
        email: superAdmin.email,
        fullName: "SuperAdmin",
        platformRole: "platform_admin",
        isSuperAdmin: true,
        authVersion: 0,
        binding: getSuperAdminConfigHash(superAdmin),
        password: superAdmin.password
      };
    const account = await AccountAdmin.findOne({ _id: userId, status: "active", deleted: false })
      .select("+password")
      .session(session || null);
    if (!account || account.email === superAdmin?.email) throw this.invalid();
    return {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      platformRole: account.platformRole as "user" | "platform_admin",
      isSuperAdmin: false,
      authVersion: account.authVersion || 0,
      binding: null,
      password: account.password
    };
  }

  /** Trả true khi password khớp credential hiện hành. */
  static async passwordValid(principal: AuthPrincipal, password: string) {
    return principal.isSuperAdmin
      ? compareSecret(password, principal.password)
      : verifyPassword(password, principal.password);
  }

  /** Kiểm tra lại phiên trong security transaction trước thao tác ghi. */
  static async assertCurrent(
    identity: AccountIdentity,
    state: SecurityState,
    session: ClientSession
  ) {
    const principal = await this.principal(identity.id, session);
    const record = await AuthSession.findOne({
      userId: identity.id,
      tokenIdHash: hashToken(identity.tokenId),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      securityVersion: state.version
    })
      .select("+credentialBinding")
      .session(session);
    if (
      !record ||
      record.authVersion !== principal.authVersion ||
      record.credentialBinding !== principal.binding
    )
      throw this.invalid();
    return { principal, record };
  }

  /** Tạo JWT và session trong transaction; caller gửi cookie chỉ sau commit. */
  static async issue(
    principal: AuthPrincipal,
    state: SecurityState,
    remember: boolean,
    metadata: RequestMetadata,
    session: ClientSession
  ): Promise<IssuedSession> {
    const seconds = Number(
      remember ? process.env.REMEMBER_SECONDS || 604800 : process.env.SESSION_SECONDS || 86400
    );
    if (!Number.isSafeInteger(seconds) || seconds <= 0)
      throw new ServiceError("Thời hạn JWT không hợp lệ!", 500);
    const tokenId = createToken();
    const token = jwt.sign(
      {
        id: principal.id,
        email: principal.email,
        isSuperAdmin: principal.isSuperAdmin,
        authVersion: principal.authVersion,
        ...(principal.binding ? { superAdminConfigHash: principal.binding } : {})
      },
      getJwtSecret(),
      { algorithm: "HS256", expiresIn: seconds, jwtid: tokenId }
    );
    const expiry = (jwt.decode(token) as { exp: number }).exp;
    await AuthSession.create(
      [
        {
          userId: principal.id,
          tokenIdHash: hashToken(tokenId),
          securityVersion: state.version,
          authVersion: principal.authVersion,
          credentialBinding: principal.binding,
          expiresAt: new Date(expiry * 1000),
          ...metadata
        }
      ],
      { session }
    );
    return {
      token,
      csrfToken: createCsrfToken(tokenId),
      maxAge: seconds * 1000,
      userId: principal.id
    };
  }

  /** Kiểm tra record/version/expiry và cập nhật lastSeenAt có throttle. */
  static async verify(userId: string, tokenId: string, principal: AuthPrincipal) {
    const record = await AuthSession.findOne({
      userId,
      tokenIdHash: hashToken(tokenId),
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }).select("+credentialBinding");
    const state = await AuthSecurity.findOne({ userId });
    if (
      !record ||
      !state ||
      record.securityVersion !== state.version ||
      record.authVersion !== principal.authVersion ||
      record.credentialBinding !== principal.binding
    )
      throw this.invalid();
    await AuthSession.updateOne(
      { _id: record._id, lastSeenAt: { $lt: new Date(Date.now() - authFeature.sessionTouchMs) } },
      { $set: { lastSeenAt: new Date() } }
    );
    return record;
  }

  /** Tăng version và thu hồi phiên/challenge/email token dưới security lock. */
  static async invalidate(userId: string, state: SecurityState, session: ClientSession) {
    state.version += 1;
    await state.save({ session });
    await AuthSession.updateMany(
      { userId, revokedAt: null },
      { revokedAt: new Date() },
      { session }
    );
    await AuthChallenge.updateMany(
      { userId, consumedAt: null },
      { consumedAt: new Date() },
      { session }
    );
    await EmailChangeToken.updateMany(
      { userId, consumedAt: null },
      { consumedAt: new Date() },
      { session }
    );
  }

  /** Phân trang phiên của owner, không xuất credential/hash. */
  static async list(identity: AccountIdentity, page: number, limit: number) {
    const state = await AuthSecurity.findOne({ userId: identity.id });
    const principal = await this.principal(identity.id);
    const filter = {
      userId: identity.id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      securityVersion: state?.version,
      authVersion: principal.authVersion,
      credentialBinding: principal.binding
    };
    const records = await AuthSession.find(filter)
      .select("+tokenIdHash")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await AuthSession.countDocuments(filter);
    return {
      items: records.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        lastSeenAt: item.lastSeenAt,
        userAgent: item.userAgent,
        ip: item.ip,
        current: item.tokenIdHash === hashToken(identity.tokenId)
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  /** Thu hồi phiên của owner; trả true nếu cần clear cookie hiện tại. */
  static async revoke(identity: AccountIdentity, sessionId?: string) {
    return AuthSecurityRepository.run(identity.id, async (state, session) => {
      const { record } = await this.assertCurrent(identity, state, session);
      const target = await AuthSession.findOne({
        _id: sessionId || record._id,
        userId: identity.id
      }).session(session);
      if (!target) throw new ServiceError("Không tìm thấy phiên!", 404, "RESOURCE_NOT_FOUND");
      if (!target.revokedAt) {
        target.revokedAt = new Date();
        await target.save({ session });
      }
      return target.id === record.id;
    });
  }
}
