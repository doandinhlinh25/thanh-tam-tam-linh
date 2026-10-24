import mongoose, { Schema, Document } from "mongoose";

export type TenantRole = "tenant_owner" | "tenant_admin" | "lecturer" | "student";
export type MembershipStatus = "active" | "inactive" | "revoked";

export interface ITenantMembership extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: TenantRole;
  status: MembershipStatus;
  joinedAt: Date;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tenantMembershipSchema = new Schema<ITenantMembership>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ["tenant_owner", "tenant_admin", "lecturer", "student"],
      required: true,
      default: "student"
    },
    status: {
      type: String,
      enum: ["active", "inactive", "revoked"],
      default: "active"
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

tenantMembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
tenantMembershipSchema.index({ tenantId: 1, role: 1 });

const TenantMembership = mongoose.model<ITenantMembership>(
  "TenantMembership",
  tenantMembershipSchema,
  "tenant_memberships"
);

export default TenantMembership;
