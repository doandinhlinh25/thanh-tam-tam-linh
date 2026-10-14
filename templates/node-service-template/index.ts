import { createServiceApp, registerErrorHandler, startService } from "@saas/http";
import { SERVICE_NAME } from "./configs/service.config";
import { registerHealthRoutes } from "./routes/health.route";

const app = createServiceApp();

registerHealthRoutes(app, SERVICE_NAME);
registerErrorHandler(app);
startService(app);
