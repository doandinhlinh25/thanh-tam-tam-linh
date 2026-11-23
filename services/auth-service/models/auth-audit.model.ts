import mongoose from "mongoose";
import { authFeature } from "../configs/auth-feature.config";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    action: { type: String, required: true },
    outcome: { type: String, required: true },
    method: { type: String, default: "password" },
    reasonCode: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    expiresAt: { type: Date, default: () => new Date(Date.now() + authFeature.auditMs), expires: 0 }
  },
  { timestamps: true }
);

schema.index({ userId: 1, action: 1, createdAt: -1 });
const AuthAudit = mongoose.model("AuthAudit", schema, "auth_audit_logs");
export default AuthAudit;
