import mongoose, { Schema, Document } from "mongoose";

export interface ILecturerAssignment extends Document {
  tenantId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lecturerAssignmentSchema = new Schema<ILecturerAssignment>(
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
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "AccountAdmin",
      default: null
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

lecturerAssignmentSchema.index({ courseId: 1, userId: 1 }, { unique: true });
lecturerAssignmentSchema.index({ tenantId: 1, userId: 1 });

const LecturerAssignment = mongoose.model<ILecturerAssignment>(
  "LecturerAssignment",
  lecturerAssignmentSchema,
  "lecturer_assignments"
);

export default LecturerAssignment;
