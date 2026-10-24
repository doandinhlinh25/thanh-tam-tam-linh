import { DailyUsage, QuotaRequest } from "../models/quota-usage.model";
import { CourseService } from "./course.service";
import { withTenant } from "../helpers/tenant.helper";
import { ServiceError } from "../helpers/error.helper";

export class QuotaService {
  /** Đếm atomic theo ngày UTC; requestId giúp retry không bị trừ quota hai lần. */
  static async consumeChat(tenantId: string, courseId: string, userId: string, requestId: string) {
    return withTenant(tenantId, userId, [], async (tenant, session) => {
      if (!(await CourseService.canAccessCourse(tenantId, courseId, userId, "chat:ask", session))) {
        throw new ServiceError("Không có quyền chat trong môn học này!", 403);
      }
      const existing = await QuotaRequest.findOne({ tenantId, requestId }).session(session);
      if (existing) {
        if (String(existing.userId) !== userId || String(existing.courseId) !== courseId) {
          throw new ServiceError("requestId đã được sử dụng cho yêu cầu khác!", 409);
        }
        return { consumed: false, requestId };
      }
      const date = new Date().toISOString().slice(0, 10);
      const usage = await DailyUsage.findOne({ tenantId, date }).session(session);
      if ((usage?.chatCount || 0) >= tenant.quota.maxDailyChats) {
        throw new ServiceError("Tenant đã đạt quota chat hôm nay!", 409);
      }
      await DailyUsage.updateOne(
        { tenantId, date },
        { $inc: { chatCount: 1 } },
        { upsert: true, session }
      );
      await QuotaRequest.create([{ tenantId, courseId, userId, requestId, date }], { session });
      return { consumed: true, requestId };
    });
  }
}
