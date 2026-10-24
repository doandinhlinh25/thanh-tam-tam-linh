import { getSuperAdminConfig } from "../config/super-admin.config";
import mongoose from "mongoose";
import { hashPassword } from "../helpers/password.helper";
import slugify from "slugify";
import AccountAdmin from "../models/account-admin.model";
import { ServiceError } from "../helpers/error.helper";
import { AuthService } from "./auth.service";

export class AccountService {
  static async getAccountById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ServiceError("ID tài khoản không hợp lệ!");
    }
    const superAdmin = getSuperAdminConfig();
    if (id.toLowerCase() === superAdmin?.id) {
      return {
        _id: new mongoose.Types.ObjectId(superAdmin.id),
        id: superAdmin.id,
        email: superAdmin.email,
        fullName: "SuperAdmin",
        status: "active",
        platformRole: "platform_admin",
        isSuperAdmin: true
      };
    }
    const account = await AccountAdmin.findOne({ _id: id, deleted: false });
    if (!account) {
      throw new ServiceError("Không tìm thấy tài khoản!", 404);
    }
    return account;
  }

  static async createAccount(data: {
    fullName: string;
    email: string;
    password: string;
    status: "initial" | "active" | "inactive";
  }) {
    if (data.email.trim().toLowerCase() === getSuperAdminConfig()?.email)
      throw new ServiceError("Email này được dành riêng cho Super Admin!", 409);
    const password = await hashPassword(data.password);
    return AccountAdmin.create({
      fullName: data.fullName,
      email: data.email,
      password,
      status: data.status,
      search: slugify([data.fullName, data.email].join(" "), { lower: true, replacement: " " })
    });
  }

  static async getAccounts(params: {
    page: number;
    limit: number;
    keyword: string;
    status?: string;
  }) {
    const find: Record<string, unknown> = { deleted: false };
    if (params.keyword) {
      const keyword = slugify(params.keyword, { lower: true, replacement: " " });
      find.search = new RegExp(keyword.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&"), "i");
    }
    if (params.status) find.status = params.status;
    const [adminList, total] = await Promise.all([
      AccountAdmin.find(find)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit),
      AccountAdmin.countDocuments(find)
    ]);
    return {
      adminList,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit)
      }
    };
  }

  /** Không cho endpoint sửa profile tự cấp platformRole hoặc thay password. */
  static async updateAccount(
    id: string,
    data: { fullName?: string; status?: string; phone?: string; description?: string }
  ) {
    if (id.toLowerCase() === getSuperAdminConfig()?.id)
      throw new ServiceError("Thông tin Super Admin được quản lý trong .env!", 403);
    const account = await this.getAccountById(id);
    if (account.platformRole === "platform_admin" && data.status && data.status !== "active") {
      throw new ServiceError("Không được khóa platform admin qua endpoint này!");
    }
    return mongoose.connection.transaction(async (session) => {
      const updated = await AccountAdmin.findOneAndUpdate(
        { _id: id, deleted: false },
        {
          $set: {
            ...data,
            ...(data.fullName !== undefined
              ? {
                  search: slugify([data.fullName, account.email].join(" "), {
                    lower: true,
                    replacement: " "
                  })
                }
              : {})
          },
          ...(data.status ? { $inc: { authVersion: 1 } } : {})
        },
        { new: true, runValidators: true, session }
      );

      return updated;
    });
  }

  static async deleteAccount(id: string) {
    const account = await this.getAccountById(id);
    if (account.platformRole === "platform_admin") {
      throw new ServiceError("Không được xóa platform admin qua endpoint này!");
    }
    await mongoose.connection.transaction(async (session) => {
      await AccountAdmin.updateOne(
        { _id: id },
        { $set: { deleted: true, deletedAt: new Date() }, $inc: { authVersion: 1 } },
        { session }
      );
    });
  }

  static async sendActivation(id: string) {
    const account = await this.getAccountById(id);
    await AuthService.sendPasswordToken(account.id, account.email, "set_password");
  }
}
