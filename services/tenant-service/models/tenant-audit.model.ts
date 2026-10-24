import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, required: true }
  },
  { timestamps: true }
);

// Audit chỉ lưu metadata; không ghi token, email hoặc nội dung tài liệu.
const TenantAudit = mongoose.model("TenantAudit", schema, "tenant_audit_logs");
export default TenantAudit;
