import mongoose, { Schema, Document } from "mongoose";
import { TenantRole } from "./tenant-membership.model";

export type InvitationStatus = "pending" | "accepted" | "rejected" | "expired" | "revoked";

export interface ITenantInvitation extends Document {
  tenantId: mongoose.Types.ObjectId;
  email: string;
  role: TenantRole;
  token: string;
  invitedBy?: mongoose.Types.ObjectId;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tenantInvitationSchema = new Schema<ITenantInvitation>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    role: {
      type: String,
      enum: ["tenant_owner", "tenant_admin", "lecturer", "student"],
      required: true,
      default: "student"
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "AccountAdmin",
      default: null
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired", "revoked"],
      default: "pending"
    },
    expiresAt: {
      type: Date,
      required: true
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: "AccountAdmin",
      default: null
    }
  },
  {
    timestamps: true
  }
);

tenantInvitationSchema.index({ tenantId: 1, email: 1 });

const TenantInvitation = mongoose.model<ITenantInvitation>(
  "TenantInvitation",
  tenantInvitationSchema,
  "tenant_invitations"
);

export default TenantInvitation;
