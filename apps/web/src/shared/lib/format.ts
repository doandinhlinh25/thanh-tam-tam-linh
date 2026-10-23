import type { Course } from "../domain/types";

export const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export function courseName(courses: Course[], courseId: string): string {
  return courses.find((course) => course.id === courseId)?.name ?? "Chưa phân môn học";
}
