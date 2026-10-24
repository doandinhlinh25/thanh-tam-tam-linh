import { registerHealthRoutes } from "./routes/health.route";
import { SERVICE_NAME } from "./configs/service.config";
import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import adminRoutes from "./routes/admin/index.route";
import accountRoutes from "./routes/admin/account.route";
import internalRoutes from "./routes/internal.route";
import { errorResponse } from "./helpers/error.helper";

if (process.env.NODE_ENV !== "test") dotenv.config();

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
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
registerHealthRoutes(app, SERVICE_NAME);
app.get("/health/live", (_req, res) => res.json({ code: "success", service: SERVICE_NAME }));
app.get("/health/ready", async (_req, res) => {
  try {
    await mongoose.connection.db!.admin().ping();
    res.json({ code: "success", message: "Sẵn sàng!" });
  } catch {
    res.status(503).json({ code: "error", message: "MongoDB chưa sẵn sàng!" });
  }
});
app.use("/admin", adminRoutes);
app.use("/api/v1/auth", accountRoutes);
app.use("/internal", internalRoutes);
app.use((_req, res) =>
  res.status(404).json({ code: "error", message: "Không tìm thấy đường dẫn!" })
);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  errorResponse(res, error);
});
export default app;
