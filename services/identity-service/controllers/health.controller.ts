import { success } from "@saas/common";
import type { RequestHandler } from "@saas/http";
import { getHealthStatus } from "../services/health.service";

/**
 * Creates the HTTP handler for this service's health response.
 *
 * @param serviceName - Name included in the response payload.
 * @returns An Express request handler.
 */
export function createHealthController(serviceName: string): RequestHandler {
  return (_request, response) => {
    response.json(success(getHealthStatus(serviceName)));
  };
}
