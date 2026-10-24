import { registerHealthRoutes } from "./routes/health.route";
import { SERVICE_NAME } from "./configs/service.config";
import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { connectDB } from "./config/database";
import adminRoutes from "./routes/admin/index.route";
import internalRoutes from "./routes/internal.route";
import { errorResponse } from "./helpers/error.helper";

if (process.env.NODE_ENV !== "test") dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4002);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Cấu hình CORS, JSON và cookie.
app.disable("x-powered-by");
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"]
  })
);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Thiết lập đường dẫn.
app.use("/admin", adminRoutes);
app.use("/internal", internalRoutes);
registerHealthRoutes(app, SERVICE_NAME);
app.get("/health/live", (_req, res) => res.json({ code: "success", service: SERVICE_NAME }));
app.get("/health/ready", async (_req, res) => {
  try {
    await mongoose.connection.db!.admin().ping();
    const auth = await fetch(new URL("/health/ready", process.env.AUTH_SERVICE_URL), {
      signal: AbortSignal.timeout(3000)
    });
    if (!auth.ok) throw new Error();
    res.json({ code: "success", message: "Sẵn sàng!" });
  } catch {
    res.status(503).json({ code: "error", message: "MongoDB hoặc Auth chưa sẵn sàng!" });
  }
});
app.use((_req, res) => {
  res.status(404).json({ code: "error", message: "Không tìm thấy đường dẫn!" });
});
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  errorResponse(res, error);
});

const start = async () => {
  if (
    !process.env.AUTH_SERVICE_URL ||
    !allowedOrigins.length ||
    !process.env.AUTH_TENANT_TOKEN ||
    process.env.AUTH_TENANT_TOKEN.length < 32
  ) {
    throw new Error("Thiếu cấu hình Auth hoặc CORS!");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT không hợp lệ!");
  await connectDB();
  const server = app.listen(port, () => console.log("Tenant service đang chạy trên cổng " + port));
  server.on("error", () => {
    process.exitCode = 1;
    void mongoose.disconnect();
  });
  const shutdown = () =>
    server.close(() => {
      void mongoose.disconnect();
    });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
};

start().catch(async () => {
  console.error("Không thể khởi động Tenant service, kiểm tra cấu hình MongoDB!");
  process.exitCode = 1;
  await mongoose.disconnect();
});
