const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServiceApp, registerErrorHandler } = require("@saas/http");
const { registerHealthRoutes: registerIdentityHealth } = require("../services/identity-service/dist/routes/health.route.js");
const { registerHealthRoutes: registerTenantHealth } = require("../services/tenant-service/dist/routes/health.route.js");
const { registerHealthRoutes: registerBillingHealth } = require("../services/billing-service/dist/routes/health.route.js");
const { registerHealthRoutes: registerNotificationHealth } = require("../services/notification-service/dist/routes/health.route.js");
const { SERVICE_NAME: IDENTITY_NAME } = require("../services/identity-service/dist/configs/service.config.js");
const { SERVICE_NAME: TENANT_NAME } = require("../services/tenant-service/dist/configs/service.config.js");
const { SERVICE_NAME: BILLING_NAME } = require("../services/billing-service/dist/configs/service.config.js");
const { SERVICE_NAME: NOTIFICATION_NAME } = require("../services/notification-service/dist/configs/service.config.js");

const LOOPBACK_HOST = "127.0.0.1";
const EPHEMERAL_PORT = 0;
const HTTP_PROTOCOL = "http:";
const HEALTH_PATH = "/health";
const HEALTH_STATUS = "ok";
const SUCCESS_STATUS = 200;

async function assertHealthRoute(registerHealthRoutes, serviceName) {
  const app = createServiceApp();
  registerHealthRoutes(app, serviceName);
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
    const healthResponse = await fetch(new URL(HEALTH_PATH, baseUrl));
    assert.equal(healthResponse.status, SUCCESS_STATUS);
    assert.deepEqual(await healthResponse.json(), {
      successful: true,
      data: { service: serviceName, status: HEALTH_STATUS },
      error: null
    });
  } finally {
    server.close();
  }
}

test("each service owns its route, controller, service and response DTO", async () => {
  await assertHealthRoute(registerIdentityHealth, IDENTITY_NAME);
  await assertHealthRoute(registerTenantHealth, TENANT_NAME);
  await assertHealthRoute(registerBillingHealth, BILLING_NAME);
  await assertHealthRoute(registerNotificationHealth, NOTIFICATION_NAME);
});
