import { HEALTH_STATUS } from "../configs/health.config";
import type { HealthResponseDto } from "../dto/response/health.response";

/**
 * Returns the service's technical health state.
 *
 * @param serviceName - Name of the running service.
 * @returns A health payload for the API boundary.
 */
export function getHealthStatus(serviceName: string): HealthResponseDto {
  return { service: serviceName, status: HEALTH_STATUS };
}
