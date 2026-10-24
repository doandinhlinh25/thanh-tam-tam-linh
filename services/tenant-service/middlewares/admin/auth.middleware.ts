import { NextFunction, Response } from "express";
import { AccountRequest } from "../../interfaces/request.interface";
import { AuthClient } from "../../helpers/auth.helper";
import { errorResponse } from "../../helpers/error.helper";

export const verifyToken = async (req: AccountRequest, res: Response, next: NextFunction) => {
  try {
    req.accountUser = await AuthClient.getIdentity(req.get("cookie") || "");
    req.adminId = req.accountUser.id;
    res.locals.accountAdmin = req.accountUser;
    next();
  } catch (error) {
    errorResponse(res, error);
  }
};

/** Platform admin chỉ quản lý lifecycle tenant, không tự động có quyền nội dung course. */
export const checkPermission = (permission: string) => {
  return (req: AccountRequest, res: Response, next: NextFunction) => {
    const platformPermissions = [
      "tenant-create",
      "tenant-list",
      "tenant-edit",
      "tenant-delete",
      "tenant-stats"
    ];
    if (platformPermissions.includes(permission)) {
      if (req.accountUser?.platformRole === "platform_admin") {
        next();
        return;
      }
    } else {
      const readPermissions = ["course-list"];
      const managementPermissions = [
        "tenant-member-manage",
        "tenant-member-list",
        "course-create",
        "course-edit",
        "course-delete",
        "course-assign-lecturer",
        "course-enroll-student"
      ];
      if (req.tenantRole && readPermissions.includes(permission)) {
        next();
        return;
      }
      if (
        req.tenantRole &&
        ["tenant_owner", "tenant_admin"].includes(req.tenantRole) &&
        managementPermissions.includes(permission)
      ) {
        next();
        return;
      }
    }
    res.status(403).json({ code: "error", message: "Không đủ quyền!" });
  };
};
