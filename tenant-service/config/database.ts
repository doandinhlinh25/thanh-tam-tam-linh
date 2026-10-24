import mongoose from "mongoose";

/** Transaction cần replica set; mỗi service dùng database riêng. */
export const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error("Vui lòng cấu hình MONGODB_URI!");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });
  const topology = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid")
    throw new Error("MongoDB phải chạy replica set để hỗ trợ transaction!");
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
};
