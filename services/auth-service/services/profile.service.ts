import slugify from "slugify";
import AccountAdmin from "../models/account-admin.model";
import { AccountIdentity } from "../interfaces/request.interface";
import { ServiceError } from "../helpers/error.helper";
import { AuthSecurityRepository } from "../repositories/auth-security.repository";
import { SessionService } from "./session.service";
import { MfaService } from "./mfa.service";

/** Profile tự phục vụ không nhận role, status, email hay password. */
export interface ProfileUpdate {
  fullName?: string;
  phone?: string;
  description?: string;
  avatar?: string | null;
}

/** Chỉ thao tác hồ sơ của danh tính đã xác minh, không dùng ID do client tự khai. */
export class ProfileService {
  /** Đọc hồ sơ đã lọc; không tạo AccountAdmin giả cho Super Admin. */
  static async get(identity: AccountIdentity) {
    const mfa = await MfaService.status(identity.id);
    if (identity.isSuperAdmin)
      return {
        id: identity.id,
        email: identity.email,
        fullName: identity.fullName,
        platformRole: identity.platformRole,
        isSuperAdmin: true,
        mfaEnabled: mfa.enabled
      };
    const account = await AccountAdmin.findOne({
      _id: identity.id,
      status: "active",
      deleted: false
    });
    if (!account) throw SessionService.invalid();
    return {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      platformRole: account.platformRole,
      isSuperAdmin: false,
      phone: account.phone,
      description: account.description,
      avatar: account.avatar,
      mfaEnabled: mfa.enabled
    };
  }

  /** Chỉ sửa allowlist của owner và search index; Super Admin env-managed bị từ chối. */
  static async update(identity: AccountIdentity, data: ProfileUpdate) {
    if (identity.isSuperAdmin)
      throw new ServiceError("Thông tin Super Admin được quản lý trong .env!", 403, "FORBIDDEN");
    await AuthSecurityRepository.run(identity.id, async (state, session) => {
      const { principal } = await SessionService.assertCurrent(identity, state, session);
      const update: ProfileUpdate & { search?: string } = {};
      for (const key of ["fullName", "phone", "description", "avatar"] as const)
        if (data[key] !== undefined) Object.assign(update, { [key]: data[key] });
      if (update.fullName !== undefined)
        update.search = slugify([update.fullName, principal.email].join(" "), {
          lower: true,
          replacement: " "
        });
      await AccountAdmin.updateOne(
        { _id: identity.id, deleted: false, status: "active" },
        { $set: update },
        { session, runValidators: true }
      );
    });
    return this.get(identity);
  }
}
