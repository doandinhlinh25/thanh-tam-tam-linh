import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    targetEmail: { type: String, required: true },
    securityVersion: { type: Number, required: true },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, expires: 0 }
  },
  { timestamps: true }
);
export default mongoose.model("EmailChangeToken", schema, "email_change_tokens");
