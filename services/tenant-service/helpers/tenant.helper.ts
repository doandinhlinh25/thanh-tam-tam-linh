import mongoose, { ClientSession } from "mongoose";
import Tenant, { ITenant } from "../models/tenant.model";
import TenantMembership from "../models/tenant-membership.model";
import TenantAudit from "../models/tenant-audit.model";
import { ServiceError } from "./error.helper";

/** Ghi revision để các request thay quyền/quota xung đột và retry cùng transaction. */
export const withTenant = async <T>(
  tenantId: string,
  actorId: string,
  roles: string[],
  work: (tenant: ITenant, session: ClientSession) => Promise<T>
) => {
  if (!mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(actorId)) {
    throw new ServiceError("ID không hợp lệ!");
  }
  return mongoose.connection.transaction(async (session) => {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: tenantId, deleted: false, status: "active" },
      { $inc: { revision: 1 } },
      { new: true, session }
    );
    if (!tenant) throw new ServiceError("Tenant không tồn tại hoặc không hoạt động!", 404);
    const member = await TenantMembership.findOne({
      tenantId,
      userId: actorId,
      deleted: false,
      status: "active"
    }).session(session);
    if (!member || (roles.length > 0 && !roles.includes(member.role))) {
      throw new ServiceError("Bạn không đủ quyền trong Tenant này!", 403);
    }
    const result = await work(tenant, session);
    await TenantAudit.create([{ tenantId, userId: actorId, action: "tenant_write" }], { session });
    return result;
  });
};

/** Không cho input tìm kiếm được hiểu như biểu thức regex. */
export const escapeRegex = (value: string) => value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
