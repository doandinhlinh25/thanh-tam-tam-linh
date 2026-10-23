import { Response } from "express";
import { AccountRequest } from "../../interfaces/request.interface";
import { MembershipService } from "../../services/membership.service";

/**
 * Thêm thành viên trực tiếp vào Tenant
 */
export const addMember = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const { userId, role } = req.body;

    const membership = await MembershipService.addMember({
      tenantId,
      userId,
      role
    });

    res.json({
      code: "success",
      message: "Thêm thành viên vào Tenant thành công!",
      membership
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi thêm thành viên!"
    });
  }
};

/**
 * Danh sách thành viên trong Tenant
 */
export const memberList = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const { role, status, search, page, limit } = req.query;

    const result = await MembershipService.getMembers(tenantId, {
      role: role as string,
      status: status as string,
      search: search as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    });

    res.json({
      code: "success",
      message: "Lấy danh sách thành viên thành công!",
      ...result
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi lấy danh sách thành viên!"
    });
  }
};

/**
 * Cập nhật vai trò thành viên
 */
export const changeMemberRole = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const memberId = String(req.params.memberId);
    const { role } = req.body;

    const membership = await MembershipService.updateMemberRole(tenantId, memberId, role);

    res.json({
      code: "success",
      message: `Cập nhật vai trò thành viên thành '${role}' thành công!`,
      membership
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi cập nhật vai trò thành viên!"
    });
  }
};

/**
 * Thu hồi quyền thành viên khỏi Tenant
 */
export const revokeMember = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const memberId = String(req.params.memberId);

    await MembershipService.revokeMember(tenantId, memberId);

    res.json({
      code: "success",
      message: "Thu hồi quyền thành viên thành công!"
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi thu hồi quyền thành viên!"
    });
  }
};

/**
 * Tạo lời mời tham gia Tenant
 */
export const createInvitation = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const { email, role } = req.body;
    const inviterId = req.adminId || req.userId;

    const invitation = await MembershipService.createInvitation({
      tenantId,
      email,
      role,
      invitedBy: inviterId
    });

    res.json({
      code: "success",
      message: "Tạo lời mời thành công!",
      invitation
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi tạo lời mời!"
    });
  }
};

/**
 * Danh sách lời mời của Tenant
 */
export const listInvitations = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const invitations = await MembershipService.listInvitations(tenantId);

    res.json({
      code: "success",
      message: "Lấy danh sách lời mời thành công!",
      invitations
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi lấy danh sách lời mời!"
    });
  }
};

/**
 * Chấp nhận lời mời (người dùng gọi endpoint này kèm token)
 */
export const acceptInvitation = async (req: AccountRequest, res: Response) => {
  try {
    const { token } = req.body;
    const userId = req.adminId || req.userId;

    if (!userId) {
      res.status(401).json({
        code: "error",
        message: "Bạn cần đăng nhập để chấp nhận lời mời!"
      });
      return;
    }

    const result = await MembershipService.acceptInvitation(token, userId);

    res.json({
      code: "success",
      ...result
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi chấp nhận lời mời!"
    });
  }
};

/**
 * Hủy lời mời
 */
export const revokeInvitation = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const invitationId = String(req.params.invitationId);

    await MembershipService.revokeInvitation(tenantId, invitationId);

    res.json({
      code: "success",
      message: "Hủy lời mời thành công!"
    });
  } catch (error: any) {
    res.json({
      code: "error",
      message: error.message || "Lỗi khi hủy lời mời!"
    });
  }
};
