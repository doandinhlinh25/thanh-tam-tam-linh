import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    purpose: { type: String, enum: ["login", "enroll"], required: true },
    securityVersion: { type: Number, required: true },
    authVersion: { type: Number, required: true },
    credentialBinding: { type: String, default: null, select: false },
    sessionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    encryptedSecret: { type: String, default: null, select: false },
    rememberPassword: { type: Boolean, default: false },
    attemptCount: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, expires: 0 }
  },
  { timestamps: true }
);
export default mongoose.model("AuthChallenge", schema, "auth_challenges");
