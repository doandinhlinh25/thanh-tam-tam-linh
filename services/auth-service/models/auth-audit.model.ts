import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    action: { type: String, required: true },
    outcome: { type: String, required: true }
  },
  { timestamps: true }
);

const AuthAudit = mongoose.model("AuthAudit", schema, "auth_audit_logs");
export default AuthAudit;
