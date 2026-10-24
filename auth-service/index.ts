import { getJwtSecret } from "./config/jwt.config";
import { getSuperAdminConfig } from "./config/super-admin.config";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "./config/database";
import app from "./app";

if (process.env.NODE_ENV !== "test") dotenv.config();

const start = async () => {
  if (
    !process.env.AUTH_TENANT_TOKEN ||
    process.env.AUTH_TENANT_TOKEN.length < 32 ||
    !process.env.ALLOWED_ORIGINS ||
    !process.env.APP_URL
  ) {
    throw new Error("Thiếu cấu hình service!");
  }
  getSuperAdminConfig();
  getJwtSecret();
  await connectDB();
  const port = Number(process.env.PORT || 4001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT không hợp lệ!");
  const server = app.listen(port, () => console.log("Auth service đang chạy trên cổng " + port));
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
  console.error("Không thể khởi động Auth service, kiểm tra cấu hình MongoDB!");
  process.exitCode = 1;
  await mongoose.disconnect();
});
