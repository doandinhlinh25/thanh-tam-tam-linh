import mongoose, { Schema, Document } from "mongoose";

export interface ITenant extends Document {
  revision: number;
  name: string;
  code: string;
  domain?: string;
  description?: string;
  logo?: string;
  status: "active" | "inactive" | "suspended";
  plan: "free" | "pro" | "enterprise";
  quota: {
    maxUsers: number;
    maxStorageMB: number;
    maxCourses: number;
    maxDailyChats: number;
  };
  createdBy?: mongoose.Types.ObjectId;
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    revision: { type: Number, default: 0 },
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    domain: {
      type: String,
      trim: true,
      default: null
    },
    description: {
      type: String,
      default: ""
    },
    logo: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    },
    plan: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free"
    },
    quota: {
      maxUsers: {
        type: Number,
        default: 50
      },
      maxStorageMB: {
        type: Number,
        default: 500
      },
      maxCourses: {
        type: Number,
        default: 10
      },
      maxDailyChats: {
        type: Number,
        default: 100
      }
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      default: null
    },
    search: {
      type: String,
      default: ""
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

tenantSchema.index({ code: 1, deleted: 1 });
tenantSchema.index({ search: "text" });

const Tenant = mongoose.model<ITenant>("Tenant", tenantSchema, "tenants");

export default Tenant;
