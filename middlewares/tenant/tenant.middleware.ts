import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AccountRequest } from "../../interfaces/request.interface";
import Tenant from "../../models/tenant.model";
import TenantMembership from "../../models/tenant-membership.model";

/**
 * Trích xuất và xác thực Tenant từ Header, Params hoặc Query
 */
export const resolveTenant = async (req: AccountRequest, res: Response, next: NextFunction) => {
  try {
    const headerVal = req.headers["x-tenant-id"];
    const paramVal = req.params.tenantId;
    const queryVal = req.query.tenantId;

    const rawTenantId = String(headerVal || paramVal || queryVal || "").trim();

    if (!rawTenantId) {
      res.status(400).json({
        code: "error",
        message: "Thiếu thông tin Tenant (x-tenant-id header, tenantId param hoặc query)!"
      });
      return;
    }

    const query: any = { deleted: false };
    if (mongoose.Types.ObjectId.isValid(rawTenantId)) {
      query._id = rawTenantId;
    } else {
      query.code = rawTenantId.toLowerCase();
    }

    const tenant = await Tenant.findOne(query);

    if (!tenant) {
      res.status(404).json({
        code: "error",
        message: "Không tìm thấy Tenant hoặc Tenant đã bị xóa!"
      });
      return;
    }

    if (tenant.status !== "active") {
      res.status(403).json({
        code: "error",
        message: `Tenant hiện tại đang ở trạng thái '${tenant.status}' và không thể truy cập!`
      });
      return;
    }

    req.tenant = tenant;
    req.tenantId = tenant._id.toString();

    next();
  } catch (error: any) {
    res.status(500).json({
      code: "error",
      message: error.message || "Lỗi máy chủ khi xác thực Tenant!"
    });
  }
};

/**
 * Kiểm tra người dùng có phải là thành viên hợp lệ trong Tenant không
 */
export const requireTenantMembership = async (
  req: AccountRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Nếu là SuperAdmin toàn platform thì có quyền tối cao
    if (res.locals.accountAdmin?.isSuperAdmin) {
      res.locals.tenantRole = "platform_admin";
      return next();
    }

    const userId = req.adminId || req.userId;
    if (!userId) {
      res.status(401).json({
        code: "error",
        message: "Chưa xác thực danh tính người dùng!"
      });
      return;
    }

    const tenantId = req.tenantId || (req.tenant?._id ? req.tenant._id.toString() : "");
    if (!tenantId) {
      res.status(400).json({
        code: "error",
        message: "Không xác định được Tenant!"
      });
      return;
    }

    const membership = await TenantMembership.findOne({
      tenantId: tenantId,
      userId: userId,
      deleted: false,
      status: "active"
    });

    if (!membership) {
      res.status(403).json({
        code: "error",
        message: "Bạn không phải thành viên của Tenant này hoặc quyền truy cập đã bị thu hồi!"
      });
      return;
    }

    res.locals.tenantRole = membership.role;
    res.locals.membership = membership;

    next();
  } catch (error: any) {
    res.status(500).json({
      code: "error",
      message: error.message || "Lỗi kiểm tra quyền thành viên Tenant!"
    });
  }
};

/**
 * Kiểm tra vai trò cụ thể trong Tenant
 * @param allowedRoles Danh sách các role được phép (vd: ['tenant_owner', 'tenant_admin'])
 */
export const requireTenantRole = (allowedRoles: string[]) => {
  return (req: AccountRequest, res: Response, next: NextFunction) => {
    const userRole = res.locals.tenantRole;

    if (userRole === "platform_admin") {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    res.status(403).json({
      code: "error",
      message: `Bạn không đủ quyền trong Tenant này! Yêu cầu một trong các vai trò: ${allowedRoles.join(", ")}`
    });
  };
};
