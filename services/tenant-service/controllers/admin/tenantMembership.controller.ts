import { errorResponse } from "../../helpers/error.helper";
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
      role,
      actorId: req.adminId!
    });

    res.json({
      code: "success",
      message: "Thêm thành viên vào Tenant thành công!",
      membership
    });
  } catch (error) {
    errorResponse(res, error);
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
  } catch (error) {
    errorResponse(res, error);
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

    const membership = await MembershipService.updateMemberRole(
      tenantId,
      memberId,
      role,
      req.adminId!
    );

    res.json({
      code: "success",
      message: `Cập nhật vai trò thành viên thành '${role}' thành công!`,
      membership
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Thu hồi quyền thành viên khỏi Tenant
 */
export const revokeMember = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const memberId = String(req.params.memberId);

    await MembershipService.revokeMember(tenantId, memberId, req.adminId!);

    res.json({
      code: "success",
      message: "Thu hồi quyền thành viên thành công!"
    });
  } catch (error) {
    errorResponse(res, error);
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
      invitedBy: inviterId!
    });

    res.json({
      code: "success",
      message: "Tạo lời mời thành công!",
      invitation
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Danh sách lời mời của Tenant
 */
export const listInvitations = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const result = await MembershipService.listInvitations(
      tenantId,
      req.query as { page?: string; limit?: string }
    );

    res.json({
      code: "success",
      message: "Lấy danh sách lời mời thành công!",
      ...result
    });
  } catch (error) {
    errorResponse(res, error);
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

    const result = await MembershipService.acceptInvitation(token, userId, req.accountUser!.email);

    res.json({
      code: "success",
      ...result
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Hủy lời mời
 */
export const revokeInvitation = async (req: AccountRequest, res: Response) => {
  try {
    const tenantId = String(req.tenantId || req.params.tenantId);
    const invitationId = String(req.params.invitationId);

    await MembershipService.revokeInvitation(tenantId, invitationId, req.adminId!);

    res.json({
      code: "success",
      message: "Hủy lời mời thành công!"
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const resendInvitation = async (req: AccountRequest, res: Response) => {
  try {
    const invitation = await MembershipService.resendInvitation(
      req.tenantId!,
      String(req.params.invitationId),
      req.adminId!
    );
    res.json({ code: "success", message: "Đã gửi lại lời mời!", invitation });
  } catch (error) {
    errorResponse(res, error);
  }
};
