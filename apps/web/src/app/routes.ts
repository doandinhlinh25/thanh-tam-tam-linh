import type { DemoRole, PageId } from "../shared/domain/types";

export const routes = {
  login: "/login",
  signup: "/signup",
  student: {
    home: "/student/home",
    courses: "/student/courses",
    documents: "/student/documents",
    assistant: "/student/assistant",
    history: "/student/history",
    account: "/student/account",
  },
  teacher: {
    home: "/teacher/home",
    courses: "/teacher/courses",
    documents: "/teacher/documents",
    feedback: "/teacher/feedback",
  },
  admin: {
    overview: "/admin/overview",
    documents: "/admin/documents",
    evaluation: "/admin/evaluation",
    feedback: "/admin/feedback",
    courses: "/admin/courses",
    settings: "/admin/settings",
  } satisfies Record<PageId, string>,
} as const;

export type StudentPage = keyof typeof routes.student;
export type TeacherPage = keyof typeof routes.teacher;

export const studentRoutes: Record<StudentPage, string> = routes.student;
export const teacherRoutes: Record<TeacherPage, string> = routes.teacher;

export function getRoleHomePath(role: DemoRole): string {
  switch (role) {
    case "student": return routes.student.home;
    case "teacher": return routes.teacher.home;
    case "admin": return routes.admin.overview;
  }
}

export function getRouteId<T extends string>(pathname: string, paths: Record<T, string>): T | undefined {
  return (Object.keys(paths) as T[]).find((id) => paths[id] === pathname);
}
