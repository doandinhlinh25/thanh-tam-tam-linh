import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Mutation thủ công cho BT3 VT-004: mỗi mutant đảo đúng một điều kiện true/false trong
 * business rule, chạy các suite liên quan, rồi khôi phục file gốc (kể cả khi bị ngắt).
 * Chạy: `node test/mutation/run-mutants.mjs [MUTANT_ID...]`. Kết quả ghi ra stdout + JSON.
 */
const helper = "services/tenant-service/helpers/enrollment-import.helper.ts";
const service = "services/tenant-service/services/course.service.ts";
const suites = {
  unit: ["npm", ["run", "-s", "test:import:unit"]],
  import: ["npm", ["run", "-s", "test:import:integration"]],
  platform: ["npm", ["run", "-s", "test:platform"]]
};

const mutants = [
  {
    id: "M1",
    rule: "Chỉ student đang active mới được ghi danh (planner)",
    file: helper,
    from: "if (!context.activeStudentIds.has(base.userId))",
    to: "if (context.activeStudentIds.has(base.userId))"
  },
  {
    id: "M2",
    rule: "Enrollment active thì skipped (planner)",
    file: helper,
    from: 'if (current === "active")',
    to: 'if (current !== "active")'
  },
  {
    id: "M3",
    rule: "Enrollment completed là trạng thái cuối (planner)",
    file: helper,
    from: 'if (current === "completed")',
    to: 'if (current !== "completed")'
  },
  {
    id: "M4",
    rule: "Trùng trong lô: lần đầu thắng (planner)",
    file: helper,
    from: "if (seen.has(base.userId))",
    to: "if (!seen.has(base.userId))"
  },
  {
    id: "M5",
    rule: "Chỉ ghi khi có dòng hợp lệ (service)",
    file: service,
    from: "if (writes.length) await CourseEnrollment.bulkWrite",
    to: "if (!writes.length) await CourseEnrollment.bulkWrite"
  },
  {
    id: "M6",
    rule: "Course xóa mềm không được import (service)",
    file: service,
    from: 'if (!course) throw new ServiceError("Không tìm thấy môn học!", 404);\n        const candidateIds',
    to: 'if (course) throw new ServiceError("Không tìm thấy môn học!", 404);\n        const candidateIds'
  },
  {
    id: "M7",
    rule: "[cũ] Ghi danh đơn lẻ trùng → 409 (enrollStudent)",
    file: service,
    from: 'if (existing?.status === "active") throw',
    to: 'if (existing?.status !== "active") throw'
  },
  {
    id: "M8",
    rule: "[cũ] Course không active thì student/lecturer không truy cập (canAccessCourse)",
    file: service,
    from: 'if (course.status !== "active") return false;',
    to: 'if (course.status === "active") return false;'
  },
  {
    id: "M9",
    rule: "[cũ] Student không được upload/xóa tài liệu (canAccessCourse)",
    file: service,
    from: 'if (["document:upload", "document:delete"].includes(action)) return false;',
    to: 'if (!["document:upload", "document:delete"].includes(action)) return false;'
  },
  {
    id: "M10",
    rule: "[cũ] Thêm lại member đang active → 409 (addMember, nguồn của guard import)",
    file: "services/tenant-service/services/membership.service.ts",
    from: 'if (existing && !existing.deleted && existing.status === "active")',
    to: 'if (existing && existing.deleted && existing.status === "active")'
  }
];

const selected = process.argv.slice(2);
const results = [];
for (const mutant of mutants.filter((item) => !selected.length || selected.includes(item.id))) {
  const path = resolve(mutant.file);
  const original = readFileSync(path, "utf8");
  if (original.split(mutant.from).length !== 2)
    throw new Error(mutant.id + ": pattern phải xuất hiện đúng 1 lần trong " + mutant.file);
  const restore = () => writeFileSync(path, original);
  process.once("SIGINT", () => {
    restore();
    process.exit(130);
  });
  writeFileSync(path, original.replace(mutant.from, mutant.to));
  const killedBy = [];
  try {
    for (const [name, [command, args]] of Object.entries(suites)) {
      const run = spawnSync(command, args, { encoding: "utf8" });
      const failed = [...run.stdout.matchAll(/^✖ (.+?) \(\d/gm)].map((match) => match[1]);
      if (run.status !== 0)
        killedBy.push({
          suite: name,
          tests: [...new Set(failed)].filter((t) => t !== "failing tests:")
        });
    }
  } finally {
    restore();
  }
  const result = {
    id: mutant.id,
    rule: mutant.rule,
    status: killedBy.length ? "KILLED" : "SURVIVED",
    killedBy
  };
  results.push(result);
  console.log(
    [
      result.id,
      result.status,
      mutant.rule,
      killedBy.map((k) => k.suite + ":" + k.tests.length).join(" ")
    ].join(" | ")
  );
}
writeFileSync(resolve("docs/assignments/bt3-23001935-vt004/evidence/05-mutation-run-final.json"), JSON.stringify(results, null, 2) + "\n");
