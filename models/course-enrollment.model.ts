import mongoose, { Schema, Document } from "mongoose";

export type EnrollmentStatus = "active" | "dropped" | "completed";

export interface ICourseEnrollment extends Document {
  tenantId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: EnrollmentStatus;
  enrolledAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const courseEnrollmentSchema = new Schema<ICourseEnrollment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "AccountAdmin",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["active", "dropped", "completed"],
      default: "active"
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

courseEnrollmentSchema.index({ courseId: 1, userId: 1 }, { unique: true });
courseEnrollmentSchema.index({ tenantId: 1, userId: 1 });

const CourseEnrollment = mongoose.model<ICourseEnrollment>(
  "CourseEnrollment",
  courseEnrollmentSchema,
  "course_enrollments"
);

export default CourseEnrollment;
