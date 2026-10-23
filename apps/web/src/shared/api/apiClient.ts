import { ApiError } from "./apiError";

type ApiSuccess<T> = { successful: true; data: T; error: null };
type ApiFailure = { successful: false; data: null; error: { errorCode: string; errorMessage: string; fieldErrors: Record<string, string> } };
type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface ApiClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope<T>(value: unknown, status: number): ApiEnvelope<T> {
  if (!isRecord(value) || typeof value.successful !== "boolean") {
    throw new ApiError("Phản hồi máy chủ không đúng định dạng.", "invalid-response", status);
  }
  if (value.successful) {
    if (!("data" in value) || value.error !== null) {
      throw new ApiError("Phản hồi thành công không đúng định dạng.", "invalid-response", status);
    }
    return value as ApiSuccess<T>;
  }
  if (value.data !== null || !isRecord(value.error)
    || typeof value.error.errorCode !== "string"
    || typeof value.error.errorMessage !== "string"
    || !isRecord(value.error.fieldErrors)
    || !Object.values(value.error.fieldErrors).every((error) => typeof error === "string")) {
    throw new ApiError("Phản hồi lỗi không đúng định dạng.", "invalid-response", status);
  }
  return value as ApiFailure;
}

/** Makes a same-origin or configured public-gateway request using the shared response envelope. */
export async function requestApi<T>(path: string, init: RequestInit = {}, options: ApiClientOptions = {}): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new ApiError("Đường dẫn API phải là đường dẫn tương đối trên gateway.", "invalid-response");
  }
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_PUBLIC_API_BASE_URL ?? window.location.origin;
  const requestUrl = new URL(path, baseUrl);
  if (requestUrl.origin !== new URL(baseUrl).origin) {
    throw new ApiError("Đường dẫn API phải giữ nguyên origin của gateway.", "invalid-response");
  }
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(requestUrl, { ...init, credentials: "include" });
  } catch {
    throw new ApiError("Không thể kết nối dịch vụ. Vui lòng thử lại.", "network");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("Dịch vụ trả về dữ liệu không đọc được.", "invalid-response", response.status);
  }
  const envelope = parseEnvelope<T>(payload, response.status);
  if (!response.ok) throw new ApiError(`Yêu cầu thất bại (HTTP ${response.status}).`, "http", response.status);
  if (!envelope.successful) {
    throw new ApiError(envelope.error.errorMessage, "api", response.status, envelope.error.errorCode, envelope.error.fieldErrors);
  }
  return envelope.data;
}
