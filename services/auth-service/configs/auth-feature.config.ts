/** Giới hạn nghiệp vụ Auth dùng chung cho validation và persistence. */
export const authFeature = {
  sessionTouchMs: 300_000,
  challengeMs: 300_000,
  enrollmentMs: 600_000,
  emailChangeMs: 1_800_000,
  auditMs: 90 * 86_400_000,
  maxAttempts: 5,
  recoveryCount: 10,
  otpPeriod: 30,
  otpWindow: 1,
  defaultLimit: 20,
  maxLimit: 100
} as const;
