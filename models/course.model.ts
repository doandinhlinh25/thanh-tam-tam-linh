import mongoose, { Schema, Document } from "mongoose";

export type CourseStatus = "active" | "draft" | "archived";

export interface ICourse extends Document {
  tenantId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  status: CourseStatus;
  createdBy?: mongoose.Types.ObjectId;
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "active"
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "AccountAdmin",
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

courseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
courseSchema.index({ tenantId: 1, deleted: 1 });
courseSchema.index({ search: "text" });

const Course = mongoose.model<ICourse>("Course", courseSchema, "courses");

export default Course;
