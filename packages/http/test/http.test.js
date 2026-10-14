const assert = require("node:assert/strict");
const { test } = require("node:test");
const { success } = require("@saas/common");
const { createServiceApp, registerErrorHandler } = require("../dist/index.js");

const TEST_PATH = "/echo";
const UNKNOWN_PATH = "/missing";
const LOOPBACK_HOST = "127.0.0.1";
const EPHEMERAL_PORT = 0;
const HTTP_PROTOCOL = "http:";
const SUCCESS_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const NOT_FOUND_CODE = "ROUTE_NOT_FOUND";
const REQUEST_PAYLOAD = Object.freeze({ value: "sample" });

test("HTTP boundary parses JSON and standardizes unknown routes", async () => {
  const app = createServiceApp();
  app.post(TEST_PATH, (request, response) => {
    response.json(success(request.body));
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
  } finally {
    server.close();
  }
});
