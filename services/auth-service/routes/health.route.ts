import type { Express } from "@saas/http";
import { HEALTH_PATH } from "../configs/health.config";
import { createHealthController } from "../controllers/health.controller";

/**
 * Registers the service-owned health endpoint.
 *
 * @param app - Express app receiving the route.
 * @param serviceName - Name included in the health response.
 */
export function registerHealthRoutes(app: Express, serviceName: string): void {
  app.get(HEALTH_PATH, createHealthController(serviceName));
}
