import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AccountRequest } from "../../interfaces/request.interface";
import Tenant from "../../models/tenant.model";
import TenantMembership from "../../models/tenant-membership.model";
import { errorResponse, ServiceError } from "../../helpers/error.helper";

/** URL/header chỉ chọn tenant; quyền luôn dựa vào membership hiện hành. */
export const resolveTenant = async (req: AccountRequest, res: Response, next: NextFunction) => {
  try {
    const rawTenantId = String(req.params.tenantId || req.get("x-tenant-id") || "");
    if (!mongoose.Types.ObjectId.isValid(rawTenantId))
      throw new ServiceError("ID Tenant không hợp lệ!");
    const tenant = await Tenant.findOne({ _id: rawTenantId, deleted: false, status: "active" });
    if (!tenant) throw new ServiceError("Không tìm thấy Tenant hoạt động!", 404);
    const member = await TenantMembership.findOne({
      tenantId: tenant._id,
      userId: req.adminId,
      deleted: false,
      status: "active"
    });
    if (!member) throw new ServiceError("Bạn không phải thành viên hoạt động của Tenant này!", 403);
    req.tenantId = tenant.id;
    req.tenantRole = member.role;
    res.locals.membership = member;
    next();
  } catch (error) {
    errorResponse(res, error);
  }
};
