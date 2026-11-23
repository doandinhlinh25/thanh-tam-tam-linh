import { test } from "node:test";
import assert from "node:assert/strict";
import { getMfaConfig, encryptMfaSecret, decryptMfaSecret } from "../helpers/mfa-crypto.helper";
import { MfaService } from "../services/mfa.service";
import { hashToken } from "../helpers/token.helper";

const configure = () => {
  process.env.AUTH_MFA_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString("base64");
  process.env.AUTH_MFA_KEY_ID = "unit-key";
  process.env.AUTH_MFA_ISSUER = "Thanh Tam Unit";
};

test("MFA crypto: random IV, authenticated principal/purpose, tampering and key errors fail closed", () => {
  configure();
  const secret = "TEST-SECRET";
  const encrypted = encryptMfaSecret(secret, "user-a", "active");
  assert.notEqual(encrypted, encryptMfaSecret(secret, "user-a", "active"));
  assert.equal(encrypted.includes(secret), false);
  assert.equal(decryptMfaSecret(encrypted, "user-a", "active"), secret);
  assert.throws(() => decryptMfaSecret(encrypted, "user-b", "active"));
  assert.throws(() => decryptMfaSecret(encrypted, "user-a", "pending"));
  assert.throws(() => decryptMfaSecret(encrypted + ".extra", "user-a", "active"));
  process.env.AUTH_MFA_ENCRYPTION_KEY = Buffer.alloc(32, 20).toString("base64");
  assert.throws(() => decryptMfaSecret(encrypted, "user-a", "active"));
  delete process.env.AUTH_MFA_ENCRYPTION_KEY;
  assert.throws(() => getMfaConfig());
});

test("TOTP: RFC 6238 SHA1 vectors (six least-significant digits) and time-window boundaries", () => {
  configure();
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const vectors = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"]
  ] as const;
  for (const [seconds, expected] of vectors)
    assert.equal(MfaService.totp(secret).generate({ timestamp: seconds * 1000 }), expected);
  const realNow = Date.now;
  try {
    Date.now = () => 1234567890000;
    const totp = MfaService.totp(secret);
    assert.notEqual(
      MfaService.step(secret, totp.generate({ timestamp: Date.now() + 30000 })),
      null
    );
    assert.equal(MfaService.step(secret, totp.generate({ timestamp: Date.now() + 90000 })), null);
    assert.equal(MfaService.step(secret, "123"), null);
  } finally {
    Date.now = realNow;
  }
});

test("recovery codes: independent 128-bit values, bounded count and one-way storage format", () => {
  const codes = MfaService.recoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) {
    assert.match(code, /^[A-Za-z0-9_-]{22}$/);
    assert.match(hashToken(code), /^[a-f0-9]{64}$/);
    assert.notEqual(hashToken(code), code);
  }
});
