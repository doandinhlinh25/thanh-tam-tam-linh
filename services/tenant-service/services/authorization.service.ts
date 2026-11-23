import Tenant from "../models/tenant.model";
import TenantMembership from "../models/tenant-membership.model";
import { ServiceError } from "../helpers/error.helper";
import { authReason } from "../config/auth-reason.config";

/** Resolves selected-tenant context without inventing a course permission. */
export class AuthorizationService {
  /**
   * @param tenantId Untrusted tenant selector, validated at the HTTP boundary.
   * @param userId Identity already obtained from Auth introspection.
   * @returns Canonical tenant/user IDs and the current active membership role.
   * @throws ServiceError when the tenant or membership is not active.
   */
  static async getContext(tenantId: string, userId: string) {
    const tenant = await Tenant.findOne({ _id: tenantId, status: "active", deleted: false })
      .select("_id")
      .lean();
    const membership =
      tenant &&
      (await TenantMembership.findOne({
        tenantId: tenant._id,
        userId,
        status: "active",
        deleted: false
      })
        .select("role")
        .lean());
    if (!tenant || !membership) {
      throw new ServiceError(
        "Không có quyền truy cập tenant đã chọn!",
        403,
        authReason.TENANT_ACCESS_DENIED
      );
    }
    return { tenantId: String(tenant._id), userId, role: membership.role };
  }
}
