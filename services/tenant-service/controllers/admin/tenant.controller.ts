import { errorResponse } from "../../helpers/error.helper";
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
      createdBy: creatorId!
    });

    res.json({
      code: "success",
      message: "Tạo Tenant thành công!",
      tenant
    });
  } catch (error) {
    errorResponse(res, error);
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
  } catch (error) {
    errorResponse(res, error);
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
  } catch (error) {
    errorResponse(res, error);
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
  } catch (error) {
    errorResponse(res, error);
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
  } catch (error) {
    errorResponse(res, error);
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
  } catch (error) {
    errorResponse(res, error);
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
  } catch (error) {
    errorResponse(res, error);
  }
};

export const myTenants = async (req: AccountRequest, res: Response) => {
  try {
    const result = await TenantService.getMyTenants(
      req.adminId!,
      Number(req.query.page || 1),
      Number(req.query.limit || 20)
    );
    res.json({ code: "success", ...result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const memberTenantDetail = async (req: AccountRequest, res: Response) => {
  try {
    const tenant = await TenantService.getTenantById(req.tenantId!);
    res.json({ code: "success", tenant, role: req.tenantRole });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const editSettings = async (req: AccountRequest, res: Response) => {
  try {
    const tenant = await TenantService.updateSettings(req.tenantId!, req.adminId!, req.body);
    res.json({ code: "success", message: "Cập nhật tổ chức thành công!", tenant });
  } catch (error) {
    errorResponse(res, error);
  }
};
