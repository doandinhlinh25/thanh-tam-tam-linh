import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";


async function measureTextContrast(text: Locator) {
  return text.evaluate((element) => {
    const parseColor = (value: string) => {
      if (!/^rgba?\(/.test(value)) throw new Error(`Unsupported computed color: ${value}`);
      const channels = value.match(/[\d.]+/g)?.map(Number);
      if (!channels || channels.length < 3) throw new Error(`Invalid computed color: ${value}`);
      return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
    };
    const style = getComputedStyle(element);
    const foreground = parseColor(style.color);
    if (foreground.alpha !== 1) throw new Error("Contrast check requires opaque text");
    let ancestor: Element | null = element;
    let background: ReturnType<typeof parseColor> | undefined;
    while (ancestor) {
      const candidate = parseColor(getComputedStyle(ancestor).backgroundColor);
      if (candidate.alpha > 0) {
        if (candidate.alpha !== 1) throw new Error("Contrast check requires an opaque ancestor background");
        background = candidate;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!background) throw new Error("Could not establish the rendered background color");
    const luminance = (rgb: number[]) => rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const foregroundLight = luminance(foreground.rgb);
    const backgroundLight = luminance(background.rgb);
    return {
      color: style.color,
      background: background.rgb,
      fontSize: style.fontSize,
      ratio: (Math.max(foregroundLight, backgroundLight) + 0.05) / (Math.min(foregroundLight, backgroundLight) + 0.05),
    };
  });
}

async function openStudentAssistant(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Sinh viên/ }).click();
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name: "Trợ lý AI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hỏi đáp cùng AI" })).toBeVisible();
}

test("demo entry reaches the student home and personal library route", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await page.getByRole("button", { name: /Sinh viên/ }).click();
  await expect(page).toHaveURL(/\/student\/home$/);
  await expect(page.getByText(/hôm nay bạn muốn học gì/)).toBeVisible();
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name: "Tài liệu cá nhân", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/documents$/);
  await expect(page.getByRole("heading", { name: "Thêm tài liệu của bạn" })).toBeVisible();
});

for (const width of [390, 768, 1440]) {
  test(`demo chat, citation keyboard focus and feedback work at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    await openStudentAssistant(page);
    if (width === 390) {
      const context = page.locator(".student-chat-context");
      const fullWidthNote = await context.locator(".student-scope-note").boundingBox();
      expect(fullWidthNote).not.toBeNull();
      for (const selector of [".student-personal-disclosure", ".student-demo-state-actions"]) {
        const bounds = await context.locator(selector).boundingBox();
        expect(bounds).not.toBeNull();
        expect(Math.abs(bounds!.width - fullWidthNote!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(bounds!.x - fullWidthNote!.x)).toBeLessThanOrEqual(1);
      }
    }
    const chat = page.getByRole("log", { name: "Lịch sử trò chuyện" });
    const question = "Giải thích lan truyền ngược trong quá trình huấn luyện?";
    await page.getByRole("textbox", { name: "Câu hỏi của bạn" }).fill(question);
    await page.getByRole("textbox", { name: "Câu hỏi của bạn" }).press("Enter");
    await expect(chat.getByText(question)).toBeVisible();
    await expect(chat.getByText("Có nguồn tham khảo", { exact: true })).toHaveCount(2);

    const citation = chat.getByRole("button", { name: /Bài giảng tuần 06/ }).last();
    await citation.click();
    const dialog = page.getByRole("dialog", { name: /Bài giảng tuần 06/ });
    const close = dialog.getByRole("button", { name: "Đóng chi tiết nguồn" });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await expect(dialog.getByText(/Chưa có đường dẫn xem hoặc tải tài liệu thật/)).toBeVisible();
    const contrastMeasurements = [];
    for (const selector of [".citation-drawer-disclosure", ".citation-drawer-meta span"]) {
      const measurement = await measureTextContrast(dialog.locator(selector));
      expect(measurement.ratio, `${selector} must meet normal-text contrast at ${width}px`).toBeGreaterThanOrEqual(4.5);
      contrastMeasurements.push({ selector, ...measurement });
    }
    const contrastPath = testInfo.outputPath("citation-text-contrast.json");
    await writeFile(contrastPath, JSON.stringify(contrastMeasurements, null, 2));
    await testInfo.attach("citation-text-contrast", { path: contrastPath, contentType: "application/json" });
    expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
    expect(await dialog.evaluate((element) => {
      const panel = element.querySelector(".citation-drawer");
      const bounds = panel?.getBoundingClientRect();
      return !!panel && !!bounds && bounds.left >= 0 && bounds.right <= window.innerWidth
        && bounds.top >= 0 && bounds.bottom <= window.innerHeight && panel.scrollWidth <= panel.clientWidth;
    })).toBe(true);
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    // Native modality must also stop focus being moved to the background.
    await page.getByRole("textbox", { name: "Câu hỏi của bạn", includeHidden: true }).evaluate((element: HTMLTextAreaElement) => element.focus());
    await expect(close).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`citation-drawer-${width}.png`) });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(citation).toBeFocused();
    await citation.press("Enter");
    await close.click();
    await expect(dialog).not.toBeVisible();
    await expect(citation).toBeFocused();
    if (width > 420) {
      await citation.click();
      await expect(dialog).toBeVisible();
      await dialog.click({ position: { x: 5, y: 5 } });
      await expect(dialog).not.toBeVisible();
      await expect(citation).toBeFocused();
    }

    const positive = chat.getByRole("button", { name: "Câu trả lời hữu ích", exact: true }).last();
    const negative = chat.getByRole("button", { name: "Câu trả lời chưa hữu ích", exact: true }).last();
    await positive.click();
    await expect(positive).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("checkbox", { name: "Mô phỏng lỗi đánh giá một lần" }).check();
    await negative.click();
    await expect(chat.getByRole("alert")).toHaveText("Lỗi đánh giá mô phỏng. Lựa chọn trước đó chưa thay đổi.");
    await expect(positive).toHaveAttribute("aria-pressed", "true");
    await expect(negative).toHaveAttribute("aria-pressed", "false");
    await chat.getByRole("button", { name: "Thử lại đánh giá" }).click();
    await expect(negative).toHaveAttribute("aria-pressed", "true");
    await expect(positive).toHaveAttribute("aria-pressed", "false");
    await expect(chat.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Đã ghi nhận đánh giá trong phiên demo.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(browserErrors).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`chat-feedback-${width}.png`), fullPage: true });
  });
}

test("demo retry replaces the failed response and keeps conversations within their courses", async ({ page }) => {
  await openStudentAssistant(page);
  const course = page.getByRole("combobox", { name: "Chọn môn học" });
  const chat = page.getByRole("log", { name: "Lịch sử trò chuyện" });
  await course.selectOption("course-1");
  await expect(chat.getByText("Chưa có câu hỏi trong môn này", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mô phỏng lỗi kỹ thuật" }).click();
  const retry = chat.getByRole("button", { name: "Thử lại câu hỏi" });
  await expect(retry).toBeVisible();
  await expect(chat.getByText(/Không thể hoàn tất câu hỏi/)).toBeVisible();
  await retry.click();
  await expect(chat.getByText(/chưa tìm thấy đủ thông tin/)).toBeVisible();
  await expect(retry).toHaveCount(0);
  await expect(chat.getByText("Mô phỏng lỗi demo")).toHaveCount(1);
  await expect(chat.getByRole("button", { name: "Câu trả lời hữu ích", exact: true })).toHaveCount(0);

  await course.selectOption("course-2");
  await expect(chat.getByText("Mô phỏng lỗi demo")).toHaveCount(0);
  await page.getByRole("button", { name: "Khi nào nên dùng index?", exact: true }).click();
  await expect(chat.getByRole("button", { name: /SQL Query Optimization/ })).toBeVisible();
  await expect(chat.getByText(/chưa tìm thấy đủ thông tin/)).toHaveCount(0);
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name: "Lịch sử hỏi đáp", exact: true }).click();
  await page.getByRole("button", { name: /CS101.*Mô phỏng lỗi demo/ }).click();
  await expect(course).toHaveValue("course-1");
  await expect(chat.getByText(/chưa tìm thấy đủ thông tin/)).toBeVisible();
  await expect(chat.getByRole("button", { name: /SQL Query Optimization/ })).toHaveCount(0);
});


test("demo permission denial and dependency failure remain distinct from insufficient evidence", async ({ page }, testInfo) => {
  await openStudentAssistant(page);
  const course = page.getByRole("combobox", { name: "Chọn môn học" });
  const chat = page.getByRole("log", { name: "Lịch sử trò chuyện" });
  await course.selectOption("course-1");
  await page.getByRole("button", { name: "Mô phỏng lỗi quyền", exact: true }).click();
  await expect(chat.getByText("Lỗi quyền mô phỏng", { exact: true })).toBeVisible();
  const errorContrastMeasurements = [];
  const permissionContrast = await measureTextContrast(chat.getByText("Lỗi quyền mô phỏng", { exact: true }));
  expect(permissionContrast.ratio, "Permission error badge must meet normal-text contrast").toBeGreaterThanOrEqual(4.5);
  errorContrastMeasurements.push({ kind: "permission", ...permissionContrast });
  await expect(chat.getByText(/không kiểm tra quyền.*máy chủ/)).toBeVisible();
  await expect(chat.getByText(/chưa tìm thấy đủ thông tin/)).toHaveCount(0);
  await expect(chat.locator(".student-citation")).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Thử lại câu hỏi", exact: true })).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Câu trả lời hữu ích", exact: true })).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Câu trả lời chưa hữu ích", exact: true })).toHaveCount(0);

  await course.selectOption("course-2");
  await expect(chat.getByText("Lỗi quyền mô phỏng", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mô phỏng lỗi phụ thuộc", exact: true }).click();
  await expect(chat.getByText("Dịch vụ mô phỏng chưa sẵn sàng", { exact: true })).toBeVisible();
  const dependencyContrast = await measureTextContrast(chat.getByText("Dịch vụ mô phỏng chưa sẵn sàng", { exact: true }));
  expect(dependencyContrast.ratio, "Dependency error badge must meet normal-text contrast").toBeGreaterThanOrEqual(4.5);
  errorContrastMeasurements.push({ kind: "dependency", ...dependencyContrast });
  const errorContrastPath = testInfo.outputPath("error-badge-contrast.json");
  await writeFile(errorContrastPath, JSON.stringify(errorContrastMeasurements, null, 2));
  await testInfo.attach("error-badge-contrast", { path: errorContrastPath, contentType: "application/json" });
  await expect(chat.getByText(/chưa tìm thấy đủ thông tin/)).toHaveCount(0);
  await expect(chat.locator(".student-citation")).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Câu trả lời hữu ích", exact: true })).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Câu trả lời chưa hữu ích", exact: true })).toHaveCount(0);
  await chat.getByRole("button", { name: "Thử lại câu hỏi", exact: true }).click();
  await expect(chat.getByText(/chưa tìm thấy đủ thông tin/)).toBeVisible();
  await expect(chat.getByText("Dịch vụ mô phỏng chưa sẵn sàng", { exact: true })).toHaveCount(0);
  await expect(chat.getByText("Mô phỏng lỗi phụ thuộc demo")).toHaveCount(1);
  await expect(chat.getByRole("button", { name: "Thử lại câu hỏi", exact: true })).toHaveCount(0);
  await expect(chat.locator(".student-citation")).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Câu trả lời hữu ích", exact: true })).toHaveCount(0);
  await expect(chat.getByRole("button", { name: "Câu trả lời chưa hữu ích", exact: true })).toHaveCount(0);
});
