import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Tenant from "../models/tenant.model";
import AccountAdmin from "../models/account-admin.model";
import TenantMembership from "../models/tenant-membership.model";
import Course from "../models/course.model";
import LecturerAssignment from "../models/lecturer-assignment.model";
import CourseEnrollment from "../models/course-enrollment.model";

const seed = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(`${process.env.DATABASE}`);
    console.log("Connected successfully!\n");

    // 1. Tạo hoặc lấy tài khoản demo cho Giảng viên & Sinh viên
    const defaultPassword = await bcrypt.hash("123456", 10);

    const getOrCreateUser = async (fullName: string, email: string, phone: string) => {
      let user = await AccountAdmin.findOne({ email, deleted: false });
      if (!user) {
        user = await AccountAdmin.create({
          fullName,
          email,
          password: defaultPassword,
          status: "active",
          phone,
          roles: []
        });
        console.log(`Created user: ${fullName} (${email})`);
      }
      return user;
    };

    const lecturer1 = await getOrCreateUser("TS. Nguyễn Văn A", "lecturer.a@hust.edu.vn", "0912345671");
    const lecturer2 = await getOrCreateUser("ThS. Trần Thị B", "lecturer.b@vnu.edu.vn", "0912345672");
    const student1 = await getOrCreateUser("Sinh viên Lê Văn C", "student.c@hust.edu.vn", "0912345673");
    const student2 = await getOrCreateUser("Sinh viên Hoàng Thị D", "student.d@vnu.edu.vn", "0912345674");

    // 2. Seed Tenant 1: HUST
    console.log("\n--- Seeding Tenant 1: HUST ---");
    let hustTenant = await Tenant.findOne({ code: "hust", deleted: false });
    if (!hustTenant) {
      hustTenant = await Tenant.create({
        name: "Đại học Bách Khoa Hà Nội",
        code: "hust",
        domain: "hust.likaloka.com",
        description: "Tenant dành cho Đại học Bách Khoa Hà Nội",
        status: "active",
        plan: "pro",
        quota: {
          maxUsers: 200,
          maxStorageMB: 5000,
          maxCourses: 50,
          maxDailyChats: 1000
        }
      });
      console.log(`Created Tenant: ${hustTenant.name} (code: hust)`);
    } else {
      console.log(`Tenant HUST already exists: ${hustTenant.name}`);
    }

    // Gán Memberships cho HUST
    const ensureMembership = async (tenantId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, role: "tenant_owner" | "tenant_admin" | "lecturer" | "student") => {
      let m = await TenantMembership.findOne({ tenantId, userId, deleted: false });
      if (!m) {
        m = await TenantMembership.create({
          tenantId,
          userId,
          role,
          status: "active",
          joinedAt: new Date()
        });
        console.log(`  Added membership: User ${userId} as ${role}`);
      }
      return m;
    };

    await ensureMembership(hustTenant._id as mongoose.Types.ObjectId, lecturer1._id as mongoose.Types.ObjectId, "lecturer");
    await ensureMembership(hustTenant._id as mongoose.Types.ObjectId, student1._id as mongoose.Types.ObjectId, "student");

    // Tạo Courses cho HUST
    const ensureCourse = async (tenantId: mongoose.Types.ObjectId, code: string, name: string, desc: string, creatorId: mongoose.Types.ObjectId) => {
      let c = await Course.findOne({ tenantId, code, deleted: false });
      if (!c) {
        c = await Course.create({
          tenantId,
          code,
          name,
          description: desc,
          status: "active",
          createdBy: creatorId
        });
        console.log(`  Created Course: [${code}] ${name}`);
      }
      return c;
    };

    const hustCourse1 = await ensureCourse(
      hustTenant._id as mongoose.Types.ObjectId,
      "CS101",
      "CS101 - Nhập môn Lập trình và Thuật toán",
      "Khóa học nền tảng kỹ thuật lập trình HUST",
      lecturer1._id as mongoose.Types.ObjectId
    );

    const hustCourse2 = await ensureCourse(
      hustTenant._id as mongoose.Types.ObjectId,
      "AI01",
      "AI01 - Trí tuệ Nhân tạo và Ứng dụng RAG",
      "Nghiên cứu mô hình RAG và Retrieval Augmented Generation",
      lecturer1._id as mongoose.Types.ObjectId
    );

    // Gán giảng viên và ghi danh sinh viên cho HUST
    const assignLecturer = async (tenantId: mongoose.Types.ObjectId, courseId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) => {
      const existing = await LecturerAssignment.findOne({ courseId, userId });
      if (!existing) {
        await LecturerAssignment.create({ tenantId, courseId, userId, assignedAt: new Date() });
        console.log(`    Assigned Lecturer ${userId} to course ${courseId}`);
      }
    };

    const enrollStudent = async (tenantId: mongoose.Types.ObjectId, courseId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) => {
      const existing = await CourseEnrollment.findOne({ courseId, userId });
      if (!existing) {
        await CourseEnrollment.create({ tenantId, courseId, userId, status: "active", enrolledAt: new Date() });
        console.log(`    Enrolled Student ${userId} into course ${courseId}`);
      }
    };

    await assignLecturer(hustTenant._id as mongoose.Types.ObjectId, hustCourse1._id as mongoose.Types.ObjectId, lecturer1._id as mongoose.Types.ObjectId);
    await assignLecturer(hustTenant._id as mongoose.Types.ObjectId, hustCourse2._id as mongoose.Types.ObjectId, lecturer1._id as mongoose.Types.ObjectId);

    await enrollStudent(hustTenant._id as mongoose.Types.ObjectId, hustCourse1._id as mongoose.Types.ObjectId, student1._id as mongoose.Types.ObjectId);
    await enrollStudent(hustTenant._id as mongoose.Types.ObjectId, hustCourse2._id as mongoose.Types.ObjectId, student1._id as mongoose.Types.ObjectId);

    // 3. Seed Tenant 2: VNU
    console.log("\n--- Seeding Tenant 2: VNU ---");
    let vnuTenant = await Tenant.findOne({ code: "vnu", deleted: false });
    if (!vnuTenant) {
      vnuTenant = await Tenant.create({
        name: "Đại học Quốc gia Hà Nội",
        code: "vnu",
        domain: "vnu.likaloka.com",
        description: "Tenant dành cho Đại học Quốc gia Hà Nội",
        status: "active",
        plan: "free",
        quota: {
          maxUsers: 50,
          maxStorageMB: 500,
          maxCourses: 10,
          maxDailyChats: 100
        }
      });
      console.log(`Created Tenant: ${vnuTenant.name} (code: vnu)`);
    } else {
      console.log(`Tenant VNU already exists: ${vnuTenant.name}`);
    }

    await ensureMembership(vnuTenant._id as mongoose.Types.ObjectId, lecturer2._id as mongoose.Types.ObjectId, "lecturer");
    await ensureMembership(vnuTenant._id as mongoose.Types.ObjectId, student2._id as mongoose.Types.ObjectId, "student");

    const vnuCourse1 = await ensureCourse(
      vnuTenant._id as mongoose.Types.ObjectId,
      "INT2204",
      "INT2204 - Lập trình Nâng cao",
      "Lập trình hướng đối tượng và cấu trúc dữ liệu nâng cao",
      lecturer2._id as mongoose.Types.ObjectId
    );

    const vnuCourse2 = await ensureCourse(
      vnuTenant._id as mongoose.Types.ObjectId,
      "INT3401",
      "INT3401 - Khai phá Dữ liệu & AI",
      "Học máy và phân tích dữ liệu lớn",
      lecturer2._id as mongoose.Types.ObjectId
    );

    await assignLecturer(vnuTenant._id as mongoose.Types.ObjectId, vnuCourse1._id as mongoose.Types.ObjectId, lecturer2._id as mongoose.Types.ObjectId);
    await assignLecturer(vnuTenant._id as mongoose.Types.ObjectId, vnuCourse2._id as mongoose.Types.ObjectId, lecturer2._id as mongoose.Types.ObjectId);

    await enrollStudent(vnuTenant._id as mongoose.Types.ObjectId, vnuCourse1._id as mongoose.Types.ObjectId, student2._id as mongoose.Types.ObjectId);
    await enrollStudent(vnuTenant._id as mongoose.Types.ObjectId, vnuCourse2._id as mongoose.Types.ObjectId, student2._id as mongoose.Types.ObjectId);

    console.log("\nSeeding demo tenants and courses completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seed();
