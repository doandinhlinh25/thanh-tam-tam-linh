const assert = require("node:assert/strict");
const { test } = require("node:test");
const { failure, formatInstant, parseInstant, success } = require("../dist/index.js");

const PAYLOAD = Object.freeze({ id: "tenant-one" });
const ERROR = Object.freeze({
  errorCode: "TENANT_NOT_FOUND",
  errorMessage: "Tenant was not found",
  fieldErrors: Object.freeze({})
});
const INSTANT = "2026-09-16T15:30:00Z";
const INVALID_INSTANT = "2026-09-16T15:30:00";
const INVALID_CALENDAR_INSTANT = "2026-02-30T15:30:00+07:00";
const VALID_OFFSET_INSTANT = "2024-02-29T15:30:00+07:00";
const VALID_FRACTIONAL_INSTANT = "2026-09-16T15:30:00.125-03:00";

test("success and failure have distinct API states", () => {
  assert.deepEqual(success(PAYLOAD), { successful: true, data: PAYLOAD, error: null });
  assert.deepEqual(failure(ERROR), { successful: false, data: null, error: ERROR });
  assert.throws(() => failure(null), TypeError);
  assert.equal(Object.isFrozen(failure(ERROR).error.fieldErrors), true);
});

test("failure rejects malformed error details without coercing field errors", () => {
  const symbolField = Symbol("email");
  const hiddenSymbolErrors = Object.defineProperty({}, symbolField, { value: "Required", enumerable: false });
  const hiddenStringErrors = Object.defineProperty({}, "email", { value: "Required", enumerable: false });
  let changingGetterReads = 0;
  let sideEffectReads = 0;
  const changingGetterErrors = { get email() { changingGetterReads += 1; return changingGetterReads === 1 ? "Required" : 1; } };
  const stableGetterErrors = { get email() { return "Required"; } };
  const sideEffectGetterErrors = { get email() { sideEffectReads += 1; return "Required"; } };
  const setterOnlyErrors = { set email(_value) {} };
  const invalidErrors = [
    { ...ERROR, fieldErrors: null },
    { ...ERROR, fieldErrors: undefined },
    { ...ERROR, fieldErrors: "email is required" },
    { ...ERROR, fieldErrors: 1 },
    { ...ERROR, fieldErrors: ["email is required"] },
    { ...ERROR, fieldErrors: new Date(INSTANT) },
    { ...ERROR, fieldErrors: new Map([["email", "Required"]]) },
    { ...ERROR, fieldErrors: new Set(["Required"]) },
    { ...ERROR, fieldErrors: { [symbolField]: 1 } },
    { ...ERROR, fieldErrors: { [symbolField]: "Required" } },
    { ...ERROR, fieldErrors: hiddenSymbolErrors },
    { ...ERROR, fieldErrors: hiddenStringErrors },
    { ...ERROR, fieldErrors: changingGetterErrors },
    { ...ERROR, fieldErrors: stableGetterErrors },
    { ...ERROR, fieldErrors: sideEffectGetterErrors },
    { ...ERROR, fieldErrors: setterOnlyErrors },
    { ...ERROR, fieldErrors: { email: 1 } },
    { ...ERROR, errorCode: 1 },
    { ...ERROR, errorMessage: 1 }
  ];
  invalidErrors.forEach((invalidError) => {
    assert.throws(() => failure(invalidError), TypeError);
  });
  assert.equal(changingGetterReads, 0);
  assert.equal(sideEffectReads, 0);
  assert.deepEqual(failure({ ...ERROR, fieldErrors: { email: "Required" } }).error.fieldErrors, { email: "Required" });
  const nullPrototypeErrors = Object.assign(Object.create(null), { email: "Required" });
  assert.deepEqual(failure({ ...ERROR, fieldErrors: nullPrototypeErrors }).error.fieldErrors, { email: "Required" });
  const specialKeyErrors = Object.defineProperty({}, "__proto__", { value: "Required", enumerable: true });
  const specialKeyResponse = failure({ ...ERROR, fieldErrors: specialKeyErrors });
  assert.equal(Object.getPrototypeOf(specialKeyResponse.error.fieldErrors), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(specialKeyResponse.error.fieldErrors, "__proto__").value, "Required");
  assert.equal(Object.isFrozen(specialKeyResponse.error.fieldErrors), true);
});

test("instant conversion requires an offset", () => {
  assert.equal(formatInstant(parseInstant(INSTANT)), INSTANT);
  assert.throws(() => parseInstant(INVALID_INSTANT), RangeError);
});

test("instant parsing rejects impossible calendar dates and preserves valid offsets", () => {
  assert.throws(() => parseInstant(INVALID_CALENDAR_INSTANT), RangeError);
  assert.equal(parseInstant(VALID_OFFSET_INSTANT).toISOString(), "2024-02-29T08:30:00.000Z");
  assert.equal(parseInstant(VALID_FRACTIONAL_INSTANT).toISOString(), "2026-09-16T18:30:00.125Z");
});
