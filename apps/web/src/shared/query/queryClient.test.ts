import { describe, expect, it } from "vitest";
import { scopedQueryKey } from "./queryClient";

describe("session-aware query key helper", () => {
  it("separates cached data by user, tenant, and course", () => {
    const base = scopedQueryKey({ userId: "u-1", tenantId: "t-1", courseId: "c-1" }, "documents");
    expect(scopedQueryKey({ userId: "u-2", tenantId: "t-1", courseId: "c-1" }, "documents")).not.toEqual(base);
    expect(scopedQueryKey({ userId: "u-1", tenantId: "t-2", courseId: "c-1" }, "documents")).not.toEqual(base);
    expect(scopedQueryKey({ userId: "u-1", tenantId: "t-1", courseId: "c-2" }, "documents")).not.toEqual(base);
  });
});
