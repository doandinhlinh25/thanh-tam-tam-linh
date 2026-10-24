import { getSuperAdminConfig, getSuperAdminConfigHash } from "../config/super-admin.config";
import { getJwtSecret } from "../config/jwt.config";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Joi from "joi";
import slugify from "slugify";
import AccountAdmin from "../models/account-admin.model";
import ActionToken from "../models/action-token.model";
import AuthAudit from "../models/auth-audit.model";
import { AccountIdentity } from "../interfaces/request.interface";
import { createToken, hashToken, compareSecret } from "../helpers/token.helper";
import { hashPassword, verifyPassword } from "../helpers/password.helper";
import { createCsrfToken } from "../helpers/csrf.helper";
import { sendMail } from "../helpers/mail.helper";
import { ServiceError } from "../helpers/error.helper";

export class AuthService {
  /** Super Admin dùng .env; tài khoản khác dùng bcrypt/Argon2 trong MongoDB. */
  static async login(email: string, password: string, rememberPassword: boolean) {
    const superAdmin = getSuperAdminConfig();
    const normalizedEmail = email.trim().toLowerCase();
    const isSuperAdmin = !!superAdmin && normalizedEmail === superAdmin.email;
    let userId: string;
    let authVersion = 0;

    if (isSuperAdmin) {
      if (!compareSecret(password, superAdmin!.password)) {
        await AuthAudit.create({ action: "login", outcome: "denied" });
        throw new ServiceError("Email hoặc mật khẩu không chính xác!", 401);
      }
      userId = superAdmin!.id;
    } else {
      const account = await AccountAdmin.findOne({ email: normalizedEmail, deleted: false }).select(
        "+password"
      );
      const validPassword = await verifyPassword(password, account?.password);
      if (
        !account ||
        !validPassword ||
        account.status !== "active" ||
        account.id === superAdmin?.id
      ) {
        await AuthAudit.create({ action: "login", outcome: "denied" });
        throw new ServiceError("Email hoặc mật khẩu không chính xác!", 401);
      }
      userId = account.id;
      authVersion = account.authVersion || 0;
      await AccountAdmin.updateOne({ _id: account._id }, { lastLoginAt: new Date() });
    }

    const seconds = Number(
      rememberPassword
        ? process.env.REMEMBER_SECONDS || 604800
        : process.env.SESSION_SECONDS || 86400
    );
    if (!Number.isInteger(seconds) || seconds <= 0)
      throw new ServiceError("Thời hạn JWT không hợp lệ!", 500);

    const tokenId = createToken();
    const token = jwt.sign(
      {
        id: userId,
        email: normalizedEmail,
        isSuperAdmin,
        authVersion,
        ...(isSuperAdmin ? { superAdminConfigHash: getSuperAdminConfigHash(superAdmin!) } : {})
      },
      getJwtSecret(),
      {
        algorithm: "HS256",
        expiresIn: seconds,
        jwtid: tokenId
      }
    );

    await AuthAudit.create({ userId, action: "login", outcome: "success" });
    return { token, csrfToken: createCsrfToken(tokenId), maxAge: seconds * 1000, userId };
  }

  /** Chỉ nhận payload sau jwt.verify(); không lấy quyền từ claim client tự gửi. */
  static async getIdentity(decoded: unknown): Promise<AccountIdentity> {
    const { error, value } = Joi.object({
      id: Joi.string().hex().length(24).required(),
      email: Joi.string().email().required(),
      isSuperAdmin: Joi.boolean().strict().required(),
      authVersion: Joi.number().integer().min(0).required(),
      jti: Joi.string()
        .pattern(/^[A-Za-z0-9_-]{43}$/)
        .required(),
      exp: Joi.number().integer().required(),
      superAdminConfigHash: Joi.string().hex().length(64)
    })
      .unknown(true)
      .validate(decoded);
    if (error) throw new ServiceError("Token không hợp lệ!", 401);

    const superAdmin = getSuperAdminConfig();
    const tokenIdentity = {
      tokenId: value.jti as string,
      csrfHash: hashToken(createCsrfToken(value.jti))
    };

    if (value.isSuperAdmin) {
      if (
        !superAdmin ||
        value.id !== superAdmin.id ||
        value.email !== superAdmin.email ||
        !compareSecret(value.superAdminConfigHash || "", getSuperAdminConfigHash(superAdmin))
      ) {
        throw new ServiceError("Cấu hình Super Admin đã thay đổi, vui lòng đăng nhập lại!", 401);
      }
      return {
        id: superAdmin.id,
        email: superAdmin.email,
        fullName: "SuperAdmin",
        platformRole: "platform_admin",
        isSuperAdmin: true,
        ...tokenIdentity
      };
    }

    const account = await AccountAdmin.findOne({
      _id: value.id,
      email: value.email,
      status: "active",
      deleted: false
    });
    if (
      !account ||
      account.id === superAdmin?.id ||
      account.email === superAdmin?.email ||
      (account.authVersion || 0) !== value.authVersion
    ) {
      throw new ServiceError("Tài khoản hoặc token không còn hiệu lực!", 401);
    }
    return {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      platformRole: account.platformRole as "user" | "platform_admin",
      isSuperAdmin: false,
      ...tokenIdentity
    };
  }

  /** Lấy lại CSRF token cho JWT hiện tại sau reload. */
  static async getCsrfToken(identity: AccountIdentity) {
    return createCsrfToken(identity.tokenId);
  }

  /** Thay mật khẩu sẽ thu hồi toàn bộ session hiện có. */
  static async changePassword(identity: AccountIdentity, password: string, newPassword: string) {
    if (identity.isSuperAdmin)
      throw new ServiceError("Mật khẩu Super Admin được thay đổi trong .env!", 403);
    const passwordHash = await hashPassword(newPassword);

    await mongoose.connection.transaction(async (session) => {
      const account = await AccountAdmin.findOne({
        _id: identity.id,
        status: "active",
        deleted: false
      })
        .select("+password")
        .session(session);
      if (!account || !(await verifyPassword(password, account.password))) {
        throw new ServiceError("Mật khẩu hiện tại không chính xác!", 401);
      }

      await AccountAdmin.updateOne(
        { _id: account._id },
        { $set: { password: passwordHash }, $inc: { authVersion: 1 } },
        { session }
      );
      await ActionToken.updateMany(
        { userId: account._id, consumedAt: null },
        { consumedAt: new Date() },
        { session }
      );
      await AuthAudit.create(
        [{ userId: account._id, action: "password_change", outcome: "success" }],
        { session }
      );
    });
  }

  static async sendPasswordToken(
    userId: string,
    email: string,
    purpose: "password_reset" | "set_password"
  ) {
    if (userId === getSuperAdminConfig()?.id)
      throw new ServiceError("Super Admin không dùng token đặt lại mật khẩu!", 403);
    const token = createToken();
    const seconds = Number(process.env.ACTION_TOKEN_SECONDS || 1800);
    if (!Number.isSafeInteger(seconds) || seconds <= 0)
      throw new ServiceError("Thời hạn token không hợp lệ!", 500);

    await mongoose.connection.transaction(async (session) => {
      // Tuần tự hóa việc cấp token, giữ JWT hiện tại đến khi đổi mật khẩu thành công.
      const account = await AccountAdmin.findOneAndUpdate(
        { _id: userId, email, deleted: false, status: { $in: ["initial", "active"] } },
        { $inc: { __v: 1 } },
        { new: true, session }
      );
      if (!account || (purpose === "set_password" && account.status !== "initial")) {
        throw new ServiceError("Tài khoản không thể kích hoạt hoặc đặt lại mật khẩu!", 409);
      }
      await ActionToken.updateMany(
        { userId, consumedAt: null },
        { consumedAt: new Date() },
        { session }
      );
      await ActionToken.create(
        [
          {
            userId,
            purpose,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + seconds * 1000)
          }
        ],
        { session }
      );
    });

    await sendMail(
      email,
      "Thiết lập mật khẩu",
      [process.env.APP_URL, "/reset-password#token=", token].join("")
    );
  }

  static async forgotPassword(email: string) {
    if (email.trim().toLowerCase() === getSuperAdminConfig()?.email) return;
    const account = await AccountAdmin.findOne({
      email,
      deleted: false,
      status: { $in: ["initial", "active"] }
    });
    if (account) {
      try {
        await this.sendPasswordToken(account.id, account.email, "password_reset");
      } catch {
        console.error("Không thể gửi email đặt lại mật khẩu!");
      }
    }
  }

  /** Tiêu thụ reset token đúng một lần trong cùng transaction thay mật khẩu. */
  static async resetPassword(token: string, password: string) {
    const passwordHash = await hashPassword(password);

    await mongoose.connection.transaction(async (session) => {
      const action = await ActionToken.findOneAndUpdate(
        {
          tokenHash: hashToken(token),
          consumedAt: null,
          expiresAt: { $gt: new Date() }
        },
        { consumedAt: new Date() },
        { new: true, session }
      );

      if (!action || String(action.userId) === getSuperAdminConfig()?.id) {
        throw new ServiceError("Token đã hết hạn hoặc đã được sử dụng!");
      }

      const result = await AccountAdmin.updateOne(
        {
          _id: action.userId,
          deleted: false,
          status: { $in: ["initial", "active"] }
        },
        {
          $set: { password: passwordHash, status: "active", emailVerifiedAt: new Date() },
          $inc: { authVersion: 1 }
        },
        { session }
      );

      if (!result.matchedCount) {
        throw new ServiceError("Tài khoản không hợp lệ!");
      }

      await ActionToken.updateMany(
        { userId: action.userId, consumedAt: null },
        { consumedAt: new Date() },
        { session }
      );
      await AuthAudit.create(
        [{ userId: action.userId, action: "password_reset", outcome: "success" }],
        { session }
      );
    });
  }

  /** Chỉ cấp tài khoản thường qua API nội bộ dành cho lời mời. */
  static async provisionAccount(email: string) {
    if (email.trim().toLowerCase() === getSuperAdminConfig()?.email)
      throw new ServiceError("Email này được dành riêng cho Super Admin!", 409);
    const password = await hashPassword(createToken());
    const account = await AccountAdmin.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          fullName: email.split("@")[0],
          password,
          status: "initial",
          search: slugify([email.split("@")[0], email].join(" "), { lower: true, replacement: " " })
        }
      },
      { upsert: true, new: true }
    );

    if (account.deleted || account.status === "inactive") {
      throw new ServiceError("Tài khoản không hoạt động!", 409);
    }
    if (account.status === "initial") {
      await this.sendPasswordToken(account.id, account.email, "set_password");
    }
    return { id: account.id, email: account.email, fullName: account.fullName };
  }
}
