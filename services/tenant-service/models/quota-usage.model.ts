import mongoose from "mongoose";

const dailySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  chatCount: { type: Number, default: 0 }
});
dailySchema.index({ tenantId: 1, date: 1 }, { unique: true });

const requestSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    requestId: { type: String, required: true },
    date: { type: String, required: true }
  },
  { timestamps: true }
);
requestSchema.index({ tenantId: 1, requestId: 1 }, { unique: true });

export const DailyUsage = mongoose.model("DailyUsage", dailySchema, "daily_usage");
export const QuotaRequest = mongoose.model("QuotaRequest", requestSchema, "quota_requests");
