import { writeFile } from "node:fs/promises";
import os from "node:os";
import mongoose from "mongoose";
import { startHarness, Harness, Session } from "../support/platform-harness";

/**
 * Load harness BT3 VT-004: 40 tác vụ import đồng thời, mục tiêu p95 ≤ 1.5 s.
 * Mỗi tác vụ gửi 25 dòng: 20 student hợp lệ mới, 3 dòng sai định dạng, 2 user không phải student.
 * Kịch bản:
 *  - S1 "40 tenant độc lập": 40 owner khác nhau, mỗi người import vào course của tenant mình.
 *  - S2 "cùng 1 tenant": 40 tác vụ vào 40 course của CÙNG tenant → mọi transaction tranh chấp
 *    `tenant.revision` (withTenant `$inc`), là trường hợp xấu nhất của thiết kế hiện tại.
 * Sau mỗi kịch bản kiểm tra không mất dòng hợp lệ: số enrollment = số dòng hợp lệ đã gửi.
 * Chạy: `npm run load:import` (tùy chọn ROUNDS, CONCURRENCY, OUT).
 */
const CONCURRENCY = Number(process.env.CONCURRENCY || 40);
const ROUNDS = Number(process.env.ROUNDS || 5);
const WARMUP_ROUNDS = 1;
const VALID_ROWS = 20;
const P95_TARGET_MS = 1500;
const OUT = process.env.OUT || "docs/assignments/bt3-23001935-vt004/evidence/08-load-result.json";

type Task = {
  session: Session;
  tenantId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
};

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

const buildRows = (students: mongoose.Types.ObjectId[], outsiders: mongoose.Types.ObjectId[]) => [
  ...students.slice(0, 10).map((id) => ({ userId: String(id) })),
  { userId: "bad-id" },
  null,
  { userId: String(outsiders[0]) },
  ...students.slice(10).map((id) => ({ userId: String(id) })),
  { userId: 42 },
  { userId: String(outsiders[1]) }
];

const runScenario = async (harness: Harness, name: string, tasks: Task[]) => {
  const samples: number[] = [];
  const errors: string[] = [];
  let expectedEnrollments = 0;
  const statusCounts: Record<string, number> = {};
  for (let round = 0; round < WARMUP_ROUNDS + ROUNDS; round += 1) {
    const payloads = await Promise.all(
      tasks.map(async (task) => {
        const students = Array.from({ length: VALID_ROWS }, () => new mongoose.Types.ObjectId());
        const outsiders = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
        await harness.addMembers(task.tenantId, students, "student");
        return buildRows(students, outsiders);
      })
    );
    const startedAt = performance.now();
    const results = await Promise.all(
      tasks.map((task, index) =>
        harness.request(
          "POST",
          "/admin/tenant/" + task.tenantId + "/courses/" + task.courseId + "/enroll/import",
          { rows: payloads[index] },
          task.session
        )
      )
    );
    const wallMs = performance.now() - startedAt;
    expectedEnrollments += VALID_ROWS * tasks.length;
    for (const result of results) {
      statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
      if (result.status !== 200 || result.body.summary.created !== VALID_ROWS)
        errors.push(result.status + " " + JSON.stringify(result.body).slice(0, 120));
      if (round >= WARMUP_ROUNDS) samples.push(result.elapsedMs);
    }
    console.log(
      [
        name,
        "round",
        round + 1,
        round < WARMUP_ROUNDS ? "(warm-up)" : "",
        "wall",
        wallMs.toFixed(0) + "ms"
      ].join(" ")
    );
  }
  const stored = await harness.tenantDb.collection("course_enrollments").countDocuments({
    courseId: { $in: tasks.map((task) => task.courseId) },
    status: "active"
  });
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  return {
    scenario: name,
    concurrency: tasks.length,
    measuredRequests: samples.length,
    rowsPerRequest: VALID_ROWS + 5,
    p50Ms: Number(percentile(sorted, 50).toFixed(1)),
    p95Ms: Number(p95.toFixed(1)),
    p99Ms: Number(percentile(sorted, 99).toFixed(1)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(1)),
    meanMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(1)),
    statusCounts,
    errors: errors.slice(0, 5),
    errorCount: errors.length,
    validRowsSent: expectedEnrollments,
    activeEnrollmentsStored: stored,
    lostValidRows: expectedEnrollments - stored,
    p95TargetMs: P95_TARGET_MS,
    meetsTarget: p95 <= P95_TARGET_MS && errors.length === 0 && stored === expectedEnrollments
  };
};

const main = async () => {
  const harness = await startHarness();
  try {
    const independent: Task[] = [];
    for (let index = 0; index < CONCURRENCY; index += 1) {
      const ownerId = await harness.createAccount("load-owner-" + index);
      const { tenantId, courseIds } = await harness.seedTenant({ ownerId });
      independent.push({ session: await harness.login(ownerId), tenantId, courseId: courseIds[0] });
    }
    const sharedOwnerId = await harness.createAccount("load-shared-owner");
    const shared = await harness.seedTenant({ ownerId: sharedOwnerId, courses: CONCURRENCY });
    const sharedSession = await harness.login(sharedOwnerId);
    const sameTenant: Task[] = shared.courseIds.map((courseId) => ({
      session: sharedSession,
      tenantId: shared.tenantId,
      courseId
    }));
    const results = [
      await runScenario(harness, "S1-" + CONCURRENCY + "-independent-tenants", independent),
      await runScenario(harness, "S2-" + CONCURRENCY + "-courses-same-tenant", sameTenant)
    ];
    const report = {
      generatedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: os.platform() + " " + os.release(),
        cpus: os.cpus().length + "x " + os.cpus()[0]?.model,
        memoryGB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
        mongo: "mongodb-memory-server 7.0.24, replica set 1 node, wiredTiger cache 0.25GB",
        note: "Load generator, MongoDB, Auth và Tenant chạy trên cùng một máy"
      },
      rounds: ROUNDS,
      warmupRounds: WARMUP_ROUNDS,
      results
    };
    await writeFile(OUT, JSON.stringify(report, null, 2) + "\n");
    console.table(
      results.map(
        ({
          scenario,
          measuredRequests,
          p50Ms,
          p95Ms,
          p99Ms,
          maxMs,
          errorCount,
          lostValidRows,
          meetsTarget
        }) => ({
          scenario,
          measuredRequests,
          p50Ms,
          p95Ms,
          p99Ms,
          maxMs,
          errorCount,
          lostValidRows,
          meetsTarget
        })
      )
    );
    process.exitCode = results.every((result) => result.meetsTarget) ? 0 : 1;
  } finally {
    await harness.stop();
  }
};

void main();
