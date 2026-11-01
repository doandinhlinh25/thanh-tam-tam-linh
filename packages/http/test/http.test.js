const assert = require("node:assert/strict");
const { test } = require("node:test");
const { success } = require("@saas/common");
const { createServiceApp, HttpError, registerErrorHandler } = require("../dist/index.js");

const TEST_PATH = "/echo";
const UNKNOWN_PATH = "/missing";
const VALIDATION_PATH = "/validation-error";
const UNEXPECTED_PATH = "/unexpected-error";
const LOOPBACK_HOST = "127.0.0.1";
const EPHEMERAL_PORT = 0;
const HTTP_PROTOCOL = "http:";
const SUCCESS_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const NOT_FOUND_CODE = "ROUTE_NOT_FOUND";
const VALIDATION_STATUS = 422;
const VALIDATION_CODE = "INVALID_INPUT";
const VALIDATION_MESSAGE = "Input is invalid";
const INTERNAL_ERROR_STATUS = 500;
const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";
const PRIVATE_ERROR_MESSAGE = "private dependency detail";
const REQUEST_PAYLOAD = Object.freeze({ value: "sample" });

test("HTTP boundary parses JSON and standardizes known, unknown, and missing-route errors", async () => {
  const app = createServiceApp();
  app.post(TEST_PATH, (request, response) => {
    response.json(success(request.body));
  });
  app.get(VALIDATION_PATH, (_request, _response, next) => {
    next(new HttpError(VALIDATION_STATUS, VALIDATION_CODE, VALIDATION_MESSAGE, { email: "Required" }));
  });
  app.get(UNEXPECTED_PATH, () => {
    throw new Error(PRIVATE_ERROR_MESSAGE);
  });
  registerErrorHandler(app);
  const server = app.listen(EPHEMERAL_PORT, LOOPBACK_HOST);
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = new URL(`${HTTP_PROTOCOL}//${LOOPBACK_HOST}:${address.port}`);
    const testResponse = await fetch(new URL(TEST_PATH, baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(REQUEST_PAYLOAD)
    });
    const testBody = await testResponse.json();
    assert.equal(testResponse.status, SUCCESS_STATUS);
    assert.deepEqual(testBody, {
      successful: true,
      data: REQUEST_PAYLOAD,
      error: null
    });

    const missingResponse = await fetch(new URL(UNKNOWN_PATH, baseUrl));
    const missingBody = await missingResponse.json();
    assert.equal(missingResponse.status, NOT_FOUND_STATUS);
    assert.equal(missingBody.successful, false);
    assert.equal(missingBody.error.errorCode, NOT_FOUND_CODE);

    const validationResponse = await fetch(new URL(VALIDATION_PATH, baseUrl));
    const validationBody = await validationResponse.json();
    assert.equal(validationResponse.status, VALIDATION_STATUS);
    assert.deepEqual(validationBody, {
      successful: false,
      data: null,
      error: {
        errorCode: VALIDATION_CODE,
        errorMessage: VALIDATION_MESSAGE,
        fieldErrors: { email: "Required" }
      }
    });

    const unexpectedResponse = await fetch(new URL(UNEXPECTED_PATH, baseUrl));
    const unexpectedBody = await unexpectedResponse.json();
    assert.equal(unexpectedResponse.status, INTERNAL_ERROR_STATUS);
    assert.equal(unexpectedBody.successful, false);
    assert.equal(unexpectedBody.error.errorCode, INTERNAL_ERROR_CODE);
    assert.equal(JSON.stringify(unexpectedBody).includes(PRIVATE_ERROR_MESSAGE), false);
  } finally {
    server.close();
  }
});
