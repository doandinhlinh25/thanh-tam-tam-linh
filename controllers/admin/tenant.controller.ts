import { Response } from "express";
import { AccountRequest } from "../../interfaces/request.interface";
import { TenantService } from "../../services/tenant.service";

/**
 * Tạo mới Tenant
 */
export const createTenant = async (req: AccountRequest, res: Response) => {
  try {
    const creatorId = req.adminId || req.userId;
    const tenant = await TenantService.createTenant({
      ...req.body,
      createdBy: creatorId
    });

    res.json({
      code: "success",
      message: "Tạo Tenant thành công!",
      tenant
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Tạo Tenant thất bại!"
    });
  }
};

/**
 * Danh sách Tenant
 */
export const tenantList = async (req: AccountRequest, res: Response) => {
  try {
    const { search, status, plan, page, limit } = req.query;

    const result = await TenantService.getTenants({
      search: search as string,
      status: status as string,
      plan: plan as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    });

    res.json({
      code: "success",
      message: "Lấy danh sách Tenant thành công!",
      ...result
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi lấy danh sách Tenant!"
    });
  }
};

/**
 * Chi tiết Tenant
 */
export const tenantDetail = async (req: AccountRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const tenant = await TenantService.getTenantById(id);

    res.json({
      code: "success",
      message: "Lấy chi tiết Tenant thành công!",
      tenant
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi lấy thông tin Tenant!"
    });
  }
};

/**
 * Cập nhật thông tin Tenant
 */
export const tenantEdit = async (req: AccountRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const tenant = await TenantService.updateTenant(id, req.body);

    res.json({
      code: "success",
      message: "Cập nhật Tenant thành công!",
      tenant
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi cập nhật Tenant!"
    });
  }
};

/**
 * Xóa mềm Tenant
 */
export const tenantDelete = async (req: AccountRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    await TenantService.deleteTenant(id);

    res.json({
      code: "success",
      message: "Xóa Tenant thành công!"
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi xóa Tenant!"
    });
  }
};

/**
 * Đổi trạng thái Tenant (active/inactive/suspended)
 */
export const tenantChangeStatus = async (req: AccountRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;

    if (!["active", "inactive", "suspended"].includes(status)) {
      res.json({
        code: "error",
        message: "Trạng thái không hợp lệ! (chỉ chấp nhận active, inactive, suspended)"
      });
      return;
    }

    const tenant = await TenantService.changeStatus(id, status);

    res.json({
      code: "success",
      message: `Cập nhật trạng thái Tenant thành '${status}' thành công!`,
      tenant
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi cập nhật trạng thái Tenant!"
    });
  }
};

/**
 * Thống kê tài nguyên Tenant
 */
export const tenantStats = async (req: AccountRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const stats = await TenantService.getTenantStats(id);

    res.json({
      code: "success",
      message: "Lấy thống kê Tenant thành công!",
      stats
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi lấy thống kê Tenant!"
    });
  }
};
