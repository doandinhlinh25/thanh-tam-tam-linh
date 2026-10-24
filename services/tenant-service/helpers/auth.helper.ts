import Joi from "joi";
import { ServiceError } from "./error.helper";
import { AccountIdentity } from "../interfaces/request.interface";

const accountSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
  email: Joi.string().email().required(),
  fullName: Joi.string().required()
}).unknown(true);

/** Tenant chỉ gọi API Auth, không kết nối database tài khoản. */
export class AuthClient {
  private static async request(route: string, body: object, cookie = "") {
    let response: globalThis.Response;
    try {
      response = await fetch(new URL(route, process.env.AUTH_SERVICE_URL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.AUTH_TENANT_TOKEN,
          Cookie: cookie
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      throw new ServiceError("Auth service chưa sẵn sàng!", 503);
    }
    if (response.status === 401) throw new ServiceError("Phiên đăng nhập không hợp lệ!", 401);
    if (response.status === 404) throw new ServiceError("Không tìm thấy tài khoản!", 404);
    if (response.status === 409) throw new ServiceError("Tài khoản không thể nhận lời mời!", 409);
    if (!response.ok) throw new ServiceError("Không thể xác minh tài khoản!", 503);
    try {
      const data = (await response.json()) as { code: string; account: unknown };
      const { error, value } = accountSchema.validate(data.account);
      if (data.code !== "success" || error) throw new Error();
      return value;
    } catch {
      throw new ServiceError("Auth response không hợp lệ!", 503);
    }
  }

  static async getIdentity(cookie: string): Promise<AccountIdentity> {
    if (!cookie) throw new ServiceError("Vui lòng đăng nhập!", 401);
    const account = await this.request("/internal/auth/introspect", {}, cookie);
    const { error } = Joi.object({
      platformRole: Joi.string().valid("user", "platform_admin").required(),
      tokenId: Joi.string()
        .pattern(/^[A-Za-z0-9_-]{43}$/)
        .required(),
      csrfHash: Joi.string().hex().length(64).required()
    })
      .unknown(true)
      .validate(account);
    if (error) throw new ServiceError("Auth identity không hợp lệ!", 503);
    return account;
  }

  static async getAccount(userId: string): Promise<AccountIdentity> {
    return this.request("/internal/account/lookup", { userId });
  }

  static async provisionAccount(email: string): Promise<AccountIdentity> {
    return this.request("/internal/account/provision", { email });
  }
}
