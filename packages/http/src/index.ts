import "dotenv/config";
import express, { ErrorRequestHandler, Express } from "express";
import { failure } from "@saas/common";

const PORT_ENV_KEY = "PORT";
const MIN_PORT = 1;
const MAX_PORT = 65535;
const BAD_CONFIGURATION_MESSAGE = "PORT must be a valid TCP port";
const UNEXPECTED_ERROR_CODE = "INTERNAL_ERROR";
const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred";
const INTERNAL_ERROR_STATUS = 500;
const NOT_FOUND_ERROR_CODE = "ROUTE_NOT_FOUND";
const NOT_FOUND_ERROR_MESSAGE = "The requested route does not exist";
const NOT_FOUND_STATUS = 404;
const EMPTY_FIELD_ERRORS = Object.freeze({});

export type { Express, RequestHandler } from "express";

/** A technical HTTP error with a stable client-facing error code. */
export class HttpError extends Error {
  /**
   * Creates a structured HTTP error.
   *
   * @param status - HTTP status sent to the client.
   * @param errorCode - Stable code used by API clients.
   * @param message - Human-readable error description.
   * @param fieldErrors - Validation errors indexed by field name.
   */
  public constructor(
    public readonly status: number,
    public readonly errorCode: string,
    message: string,
    public readonly fieldErrors: Readonly<Record<string, string>> = EMPTY_FIELD_ERRORS
  ) {
    super(message);
  }
}

/**
 * Checks whether a port can be used by the HTTP server.
 *
 * @param port - Port parsed from the environment.
 * @returns True for a valid TCP port.
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
}

/**
 * Builds the shared HTTP boundary for one service.
 *
 * @returns Express app ready for service routes.
 */
export function createServiceApp(): Express {
  const app = express();
  app.use(express.json());
  return app;
}

/**
 * Registers the standard error response after all service routes.
 *
 * @param app - Service app with its routes already registered.
 */
export function registerErrorHandler(app: Express): void {
  app.use((_request, _response, next) => {
    next(new HttpError(NOT_FOUND_STATUS, NOT_FOUND_ERROR_CODE, NOT_FOUND_ERROR_MESSAGE));
  });
  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json(failure({
        errorCode: error.errorCode,
        errorMessage: error.message,
        fieldErrors: error.fieldErrors
      }));
      return;
    }
    response.status(INTERNAL_ERROR_STATUS).json(failure({
      errorCode: UNEXPECTED_ERROR_CODE,
      errorMessage: UNEXPECTED_ERROR_MESSAGE,
      fieldErrors: EMPTY_FIELD_ERRORS
    }));
  };
  app.use(errorHandler);
}

/**
 * Starts a service on its configured port.
 *
 * @param app - Fully configured service app.
 * @throws {RangeError} When PORT is missing or invalid.
 */
export function startService(app: Express): void {
  const configuredPort = Number(process.env[PORT_ENV_KEY]);
  if (!isValidPort(configuredPort)) {
    throw new RangeError(BAD_CONFIGURATION_MESSAGE);
  }
  app.listen(configuredPort);
}
