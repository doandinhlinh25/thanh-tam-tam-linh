import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    tokenIdHash: { type: String, required: true, unique: true, select: false },
    securityVersion: { type: Number, required: true },
    authVersion: { type: Number, required: true },
    credentialBinding: { type: String, default: null, select: false },
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" }
  },
  { timestamps: true }
);
schema.index({ userId: 1, createdAt: -1 });
export default mongoose.model("AuthSession", schema, "auth_sessions");
