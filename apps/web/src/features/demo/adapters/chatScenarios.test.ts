import { describe, expect, it } from "vitest";
import { getDemoChatResult } from "./chatScenarios";
import { createDemoChatContext, createInitialStudentChats, demoChatErrorScenarios } from "./demoData";

const context = createDemoChatContext("user-student-demo", "course-3");

describe("demo chat scenarios", () => {
  it("returns fixture citations only for a matching course answer", () => {
    const result = getDemoChatResult(context, "Mạng nơ-ron cập nhật trọng số thế nào?", false);
    expect(result.status).toBe("answered");
    if (result.status === "answered") expect(result.citations.map((citation) => citation.id)).toEqual(["cite-neural-1", "cite-neural-2"]);
  });
  it.each(["course-2", "unknown-course"])("does not reuse another course's sources in %s", (courseId) => {
    expect(getDemoChatResult({ ...context, courseId }, "Mạng nơ-ron cập nhật trọng số thế nào?", false)).toMatchObject({ status: "insufficient_evidence", citations: [] });
  });
  it("only exposes the personal fixture when personal metadata is present in that course", () => {
    expect(getDemoChatResult(context, "tài liệu cá nhân demo", false).status).toBe("insufficient_evidence");
    expect(getDemoChatResult(context, "tài liệu cá nhân demo", true)).toMatchObject({ status: "answered", citations: [{ id: "personal-demo-citation" }] });
  });
  it("returns no citations when evidence is insufficient", () => {
    expect(getDemoChatResult(context, "Chủ đề không có trong tài liệu", false)).toMatchObject({ status: "insufficient_evidence", citations: [] });
  });
  it("keeps technical failure distinct and retryable", () => {
    expect(getDemoChatResult(context, "Mô phỏng lỗi demo", false)).toMatchObject({ status: "error", retryable: true });
  });
  it("does not fabricate an answer when retrying a technical failure", () => {
    expect(getDemoChatResult(context, "Mô phỏng lỗi demo", false, true)).toMatchObject({ status: "insufficient_evidence", citations: [] });
  });
  it.each(["technical", "permission", "dependency"] as const)("keeps the %s error distinct from refusal with no citations", (errorKind) => {
    const fixture = demoChatErrorScenarios[errorKind];
    expect(getDemoChatResult(context, fixture.question, false)).toMatchObject({
      status: "error", errorKind, retryable: errorKind !== "permission", citations: [], demoContext: context, demoOnly: true,
    });
  });
  it("does not retry away a simulated permission denial", () => {
    expect(getDemoChatResult(context, demoChatErrorScenarios.permission.question, false, true)).toMatchObject({
      status: "error", errorKind: "permission", retryable: false, citations: [],
    });
  });
  it("recovers a dependency failure without inventing evidence", () => {
    expect(getDemoChatResult(context, demoChatErrorScenarios.dependency.question, false, true)).toMatchObject({
      status: "insufficient_evidence", citations: [], demoContext: context,
    });
  });
  it.each(["Mạng nơ-ron cập nhật trọng số thế nào?", "Chủ đề không có", "Mô phỏng lỗi quyền demo", "Mô phỏng lỗi phụ thuộc demo"])("traces %s to a copied tenant/user/course context", (question) => {
    const origin = { tenantId: "tenant-demo-test", userId: "student-demo-a", courseId: "course-3" };
    const result = getDemoChatResult(origin, question, false);
    origin.courseId = "course-2";
    expect(result.demoContext).toEqual({ tenantId: "tenant-demo-test", userId: "student-demo-a", courseId: "course-3" });
    expect(result.demoOnly).toBe(true);
  });
  it("does not reuse one demo identity's tracing metadata for another", () => {
    const first = getDemoChatResult(context, "nơ-ron", false);
    const other = getDemoChatResult({ ...context, tenantId: "tenant-demo-other", userId: "student-demo-other" }, "nơ-ron", false);
    expect(first.demoContext).toEqual(context);
    expect(other.demoContext).toEqual({ ...context, tenantId: "tenant-demo-other", userId: "student-demo-other" });
  });
  it("keeps seed messages attributed to the current demo user", () => {
    const seed = createInitialStudentChats("signup-demo-student");
    expect(seed["course-3"]).toHaveLength(2);
    for (const message of seed["course-3"]) {
      expect(message.demoContext).toEqual({ tenantId: "tenant-demo-minh-tam", userId: "signup-demo-student", courseId: "course-3" });
      expect(message.demoOnly).toBe(true);
    }
  });
});
