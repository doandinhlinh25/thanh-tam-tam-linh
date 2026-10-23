export const pathAdmin = "admin";

export const domainCDN = "http://localhost:4000";

export const permissionList = [
  {
    id: "dashboard",
    name: "Trang tổng quan"
  },
  // Quyền quản lý tài khoản admin
  {
    id: "account-admin-list",
    name: "Xem danh sách tài khoản quản trị"
  },
  {
    id: "account-admin-create",
    name: "Tạo tài khoản quản trị"
  },
  {
    id: "account-admin-edit",
    name: "Chỉnh sửa tài khoản quản trị"
  },
  {
    id: "account-admin-delete",
    name: "Xóa tài khoản quản trị"
  },
  {
    id: "account-admin-change-password",
    name: "Đổi mật khẩu tài khoản quản trị"
  },
  // Quyền quản lý nhóm quyền
  {
    id: "role-list",
    name: "Xem danh sách nhóm quyền"
  },
  {
    id: "role-create",
    name: "Tạo nhóm quyền"
  },
  {
    id: "role-edit",
    name: "Chỉnh sửa nhóm quyền"
  },
  {
    id: "role-delete",
    name: "Xóa nhóm quyền"
  },
  {
    id: "role-trash",
    name: "Quản lý thùng rác nhóm quyền"
  },
  // Quyền Tenant Service
  {
    id: "tenant-list",
    name: "Xem danh sách Tenant"
  },
  {
    id: "tenant-create",
    name: "Tạo mới Tenant"
  },
  {
    id: "tenant-edit",
    name: "Chỉnh sửa Tenant"
  },
  {
    id: "tenant-delete",
    name: "Xóa Tenant"
  },
  {
    id: "tenant-stats",
    name: "Xem thống kê Tenant"
  },
  // Quyền Membership trong Tenant
  {
    id: "tenant-member-list",
    name: "Xem danh sách thành viên Tenant"
  },
  {
    id: "tenant-member-manage",
    name: "Quản lý thành viên và lời mời Tenant"
  },
  // Quyền Course
  {
    id: "course-list",
    name: "Xem danh sách môn học"
  },
  {
    id: "course-create",
    name: "Tạo môn học mới"
  },
  {
    id: "course-edit",
    name: "Chỉnh sửa môn học"
  },
  {
    id: "course-delete",
    name: "Xóa môn học"
  },
  {
    id: "course-assign-lecturer",
    name: "Phân công giảng viên môn học"
  },
  {
    id: "course-enroll-student",
    name: "Ghi danh sinh viên môn học"
  }
];
