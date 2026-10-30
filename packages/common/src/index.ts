const ISO_INSTANT_WITH_OFFSET = /^(?<calendarDate>\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ZERO_MILLISECONDS_SUFFIX = /\.000Z$/;
const MIDNIGHT_UTC_SUFFIX = "T00:00:00Z";
const INVALID_INSTANT_MESSAGE = "Timestamp must be an ISO 8601 value with an offset";
const INVALID_ERROR_MESSAGE = "Error details are required";

/** Details of a failed API request. */
export interface ApiErrorResponse {
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

/** A successful or failed API response with one unambiguous state. */
export type ApiResponse<T> =
  | { readonly successful: true; readonly data: T; readonly error: null }
  | { readonly successful: false; readonly data: null; readonly error: ApiErrorResponse };

/**
 * Wraps a successful payload in the shared API contract.
 *
 * @param responseData - Payload returned to the client.
 * @returns A successful response envelope.
 */
export function success<T>(responseData: T): ApiResponse<T> {
  return { successful: true, data: responseData, error: null };
}

/**
 * Wraps an error in the shared API contract.
 *
 * @param errorResponse - Stable code, readable message and field errors.
 * @returns A failed response envelope.
 * @throws {TypeError} When required error details are missing.
 */
export function failure(errorResponse: ApiErrorResponse): ApiResponse<never> {
  const fieldErrors = errorResponse?.fieldErrors;
  const fieldErrorsPrototype = fieldErrors && typeof fieldErrors === "object"
    ? Object.getPrototypeOf(fieldErrors)
    : undefined;
  const fieldErrorsDescriptors = fieldErrorsPrototype === Object.prototype || fieldErrorsPrototype === null
    ? Object.getOwnPropertyDescriptors(fieldErrors)
    : undefined;
  if (
    !errorResponse ||
    typeof errorResponse.errorCode !== "string" || !errorResponse.errorCode ||
    typeof errorResponse.errorMessage !== "string" || !errorResponse.errorMessage ||
    !fieldErrorsDescriptors ||
    !Reflect.ownKeys(fieldErrorsDescriptors).every((fieldKey) =>
      typeof fieldKey === "string" &&
      fieldErrorsDescriptors[fieldKey].enumerable === true &&
      Object.hasOwn(fieldErrorsDescriptors[fieldKey], "value") &&
      typeof fieldErrorsDescriptors[fieldKey].value === "string"
    )
  ) {
    throw new TypeError(INVALID_ERROR_MESSAGE);
  }
  const validatedFieldErrors = Object.fromEntries(
    Object.entries(fieldErrorsDescriptors).map(([fieldKey, descriptor]) => [fieldKey, descriptor.value])
  );
  const immutableError = Object.freeze({
    errorCode: errorResponse.errorCode,
    errorMessage: errorResponse.errorMessage,
    fieldErrors: Object.freeze(validatedFieldErrors)
  });
  return { successful: false, data: null, error: immutableError };
}

/**
 * Formats an absolute time for the API boundary.
 *
 * @param dateTime - Valid date to format.
 * @returns ISO 8601 UTC timestamp.
 * @throws {RangeError} When the date is invalid.
 */
export function formatInstant(dateTime: Date): string {
  return dateTime.toISOString().replace(ZERO_MILLISECONDS_SUFFIX, "Z");
}

/**
 * Parses an ISO 8601 timestamp containing a timezone offset.
 *
 * @param timestamp - Timestamp received at the API boundary.
 * @returns The corresponding absolute time.
 * @throws {RangeError} When the timestamp is invalid or lacks an offset.
 */
export function parseInstant(timestamp: string): Date {
  const match = ISO_INSTANT_WITH_OFFSET.exec(timestamp);
  if (!match) {
    throw new RangeError(INVALID_INSTANT_MESSAGE);
  }
  const sourceCalendarDate = match.groups!.calendarDate;
  const calendarDate = new Date(sourceCalendarDate + MIDNIGHT_UTC_SUFFIX);
  const parsedDate = new Date(timestamp);
  if (
    Number.isNaN(calendarDate.getTime()) ||
    !calendarDate.toISOString().startsWith(sourceCalendarDate) ||
    Number.isNaN(parsedDate.getTime())
  ) {
    throw new RangeError(INVALID_INSTANT_MESSAGE);
  }
  return parsedDate;
}
