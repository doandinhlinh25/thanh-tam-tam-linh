import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiError";
import { requestApi } from "./apiClient";

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("gateway API envelope boundary", () => {
  it("returns data from the shared success envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ successful: true, data: { id: "c-1" }, error: null }));
    await expect(requestApi<{ id: string }>("/public/courses", {}, { baseUrl: "https://gateway.example.test", fetcher })).resolves.toEqual({ id: "c-1" });
    expect(fetcher).toHaveBeenCalledWith(new URL("/public/courses", "https://gateway.example.test"), expect.objectContaining({ credentials: "include" }));
  });

  it("preserves field errors from a shared API failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ successful: false, data: null, error: { errorCode: "INVALID", errorMessage: "Invalid input", fieldErrors: { email: "Required" } } }));
    await expect(requestApi("/public/example", {}, { baseUrl: "https://gateway.example.test", fetcher })).rejects.toMatchObject({ kind: "api", errorCode: "INVALID", fieldErrors: { email: "Required" } });
  });

  it("normalizes transport errors", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("socket"));
    await expect(requestApi("/public/example", {}, { baseUrl: "https://gateway.example.test", fetcher })).rejects.toMatchObject({ kind: "network" });
  });

  it("normalizes non-2xx HTTP responses separately from API envelope errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ successful: true, data: {}, error: null }, 503));
    await expect(requestApi("/public/example", {}, { baseUrl: "https://gateway.example.test", fetcher })).rejects.toMatchObject({ kind: "http", status: 503 });
  });

  it("rejects malformed response envelopes", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ result: "not an envelope" }));
    await expect(requestApi("/public/example", {}, { baseUrl: "https://gateway.example.test", fetcher })).rejects.toMatchObject({ kind: "invalid-response" });
  });

  it("rejects an absolute URL so calls stay on the configured gateway", async () => {
    const fetcher = vi.fn();
    await expect(requestApi("https://internal.example.test/health", {}, { baseUrl: "https://gateway.example.test", fetcher })).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects slash-backslash paths that URL parsing could resolve to another origin", async () => {
    const fetcher = vi.fn();
    await expect(requestApi("/\\evil.example/path", {}, { baseUrl: "https://gateway.example.test", fetcher })).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
