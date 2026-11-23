import mongoose, { ClientSession, HydratedDocument, InferSchemaType } from "mongoose";
import AuthSecurity from "../models/auth-security.model";

/** Trạng thái bảo mật riêng của principal, kể cả Super Admin từ env. */
export type SecurityState = HydratedDocument<InferSchemaType<typeof AuthSecurity.schema>>;

/** Serialize mọi issuance/thu hồi bằng cùng revision trong transaction. */
export class AuthSecurityRepository {
  private static async ensure(userId: string) {
    try {
      await AuthSecurity.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }

  /** Serialize callback dưới revision lock; rollback khi callback lỗi, trả kết quả sau commit. */
  static async run<T>(
    userId: string,
    work: (state: SecurityState, session: ClientSession) => Promise<T>
  ): Promise<T> {
    await this.ensure(userId);
    return mongoose.connection.transaction(async (session) => {
      const state = await AuthSecurity.findOneAndUpdate(
        { userId },
        { $inc: { revision: 1 } },
        { new: true, session }
      ).select("+encryptedSecret +recoveryHashes");
      if (!state) throw new Error("Missing security state");
      return work(state, session);
    });
  }
}
