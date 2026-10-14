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

test("success and failure have distinct API states", () => {
  assert.deepEqual(success(PAYLOAD), { successful: true, data: PAYLOAD, error: null });
  assert.deepEqual(failure(ERROR), { successful: false, data: null, error: ERROR });
  assert.throws(() => failure(null), TypeError);
  assert.equal(Object.isFrozen(failure(ERROR).error.fieldErrors), true);
});

test("instant conversion requires an offset", () => {
  assert.equal(formatInstant(parseInstant(INSTANT)), INSTANT);
  assert.throws(() => parseInstant(INVALID_INSTANT), RangeError);
});
