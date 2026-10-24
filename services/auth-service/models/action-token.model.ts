import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    purpose: { type: String, enum: ["password_reset", "set_password"], required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    consumedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

const ActionToken = mongoose.model("ActionToken", schema, "action_tokens");
export default ActionToken;
