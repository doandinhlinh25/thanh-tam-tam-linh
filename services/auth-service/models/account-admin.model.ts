import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    platformRole: { type: String, enum: ["user", "platform_admin"], default: "user" },
    status: { type: String, enum: ["initial", "active", "inactive"], default: "initial" },
    avatar: { type: String, default: null },
    description: { type: String, default: "" },
    phone: { type: String, default: "" },
    search: { type: String, default: "" },
    lastLoginAt: Date,
    emailVerifiedAt: { type: Date, default: null },
    authVersion: { type: Number, default: 0 },
    deleted: { type: Boolean, default: false },
    deletedAt: Date
  },
  { timestamps: true }
);

schema.set("toJSON", {
  transform: (_doc, value) => {
    delete (value as Record<string, unknown>).password;
    delete (value as Record<string, unknown>).authVersion;
    delete (value as Record<string, unknown>).__v;
    return value;
  }
});

const AccountAdmin = mongoose.model("AccountAdmin", schema, "accounts-admin");
export default AccountAdmin;
