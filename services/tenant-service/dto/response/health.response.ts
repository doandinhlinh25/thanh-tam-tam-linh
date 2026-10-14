/** Technical health payload returned by this service. */
export interface HealthResponseDto {
  readonly service: string;
  readonly status: string;
}
