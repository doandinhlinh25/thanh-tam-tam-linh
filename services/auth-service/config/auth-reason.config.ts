/** Stable reason codes for trusted service callers; never include secret values. */
export const authReason = {
  SESSION_INVALID: "SESSION_INVALID",
  SERVICE_CREDENTIAL_INVALID: "SERVICE_CREDENTIAL_INVALID"
} as const;
