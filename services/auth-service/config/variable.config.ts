export const pathAdmin = "admin";

// Các quyền hiện có của Auth và Tenant. Super Admin được gán toàn bộ danh sách này.
export const permissionList = [
  { id: "account-admin-list", name: "Xem tài khoản quản trị" },
  { id: "account-admin-create", name: "Tạo tài khoản quản trị" },
  { id: "account-admin-edit", name: "Chỉnh sửa tài khoản quản trị" },
  { id: "account-admin-delete", name: "Xóa tài khoản quản trị" },
  { id: "account-admin-change-password", name: "Đổi mật khẩu tài khoản quản trị" },
  { id: "tenant-list", name: "Xem danh sách Tenant" },
  { id: "tenant-create", name: "Tạo Tenant" },
  { id: "tenant-edit", name: "Chỉnh sửa Tenant" },
  { id: "tenant-delete", name: "Xóa Tenant" },
  { id: "tenant-stats", name: "Xem thống kê Tenant" },
  { id: "tenant-member-list", name: "Xem thành viên Tenant" },
  { id: "tenant-member-manage", name: "Quản lý thành viên Tenant" },
  { id: "course-list", name: "Xem môn học" },
  { id: "course-create", name: "Tạo môn học" },
  { id: "course-edit", name: "Chỉnh sửa môn học" },
  { id: "course-delete", name: "Xóa môn học" },
  { id: "course-assign-lecturer", name: "Phân công giảng viên" },
  { id: "course-enroll-student", name: "Ghi danh sinh viên" }
];
