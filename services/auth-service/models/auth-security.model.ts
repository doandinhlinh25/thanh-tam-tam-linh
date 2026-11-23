import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    version: { type: Number, default: 0 },
    revision: { type: Number, default: 0 },
    mfaEnabled: { type: Boolean, default: false },
    encryptedSecret: { type: String, default: null, select: false },
    lastAcceptedStep: { type: Number, default: -1 },
    recoveryHashes: { type: [String], default: [], select: false }
  },
  { timestamps: true }
);
export default mongoose.model("AuthSecurity", schema, "auth_security");
