import { expect, test } from "@playwright/test";

test("demo entry reaches the student home and personal library route", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await page.getByRole("button", { name: /Sinh viên/ }).click();
  await expect(page).toHaveURL(/\/student\/home$/);
  await expect(page.getByText(/hôm nay bạn muốn học gì/)).toBeVisible();
  await page.getByRole("button", { name: "Tài liệu cá nhân" }).click();
  await expect(page).toHaveURL(/\/student\/documents$/);
  await expect(page.getByRole("heading", { name: "Thêm tài liệu của bạn" })).toBeVisible();
});
