import mongoose from "mongoose";

/** JWT login không cần transaction; các nghiệp vụ reset vẫn cần MongoDB replica set. */
export const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error("Vui lòng cấu hình MONGODB_URI!");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
};
