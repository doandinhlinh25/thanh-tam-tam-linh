const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const OPENAPI_DIRECTORY = path.join(__dirname, "..", "contracts", "openapi");
const CHAT_SPEC_PATH = path.join(OPENAPI_DIRECTORY, "chat.yaml");
const RETRIEVAL_SPEC_PATH = path.join(OPENAPI_DIRECTORY, "retrieval-evidence.yaml");
const CHAT_SPEC = fs.readFileSync(CHAT_SPEC_PATH, "utf8");
const RETRIEVAL_SPEC = fs.readFileSync(RETRIEVAL_SPEC_PATH, "utf8");

test("Chat contract exposes chat, history, feedback and privacy routes", () => {
  for (const route of [
    "  /courses/{courseId}/chat:",
    "  /personal-documents/chat:",
    "  /conversations:",
    "  /conversations/{conversationId}:",
    "  /messages/{messageId}/feedback:"
  ]) {
    assert.ok(CHAT_SPEC.includes(route), "Missing OpenAPI route: " + route);
  }
});

test("Chat result distinguishes evidence-backed answers from refusals", () => {
  assert.ok(CHAT_SPEC.includes("enum: [answered, insufficient_evidence]"));
  assert.ok(CHAT_SPEC.includes("minItems: 1"));
  assert.ok(CHAT_SPEC.includes("maxItems: 0"));
  assert.ok(CHAT_SPEC.includes("citation_id"));
  assert.ok(CHAT_SPEC.includes("source_type"));
  assert.ok(CHAT_SPEC.includes("page_from"));
  assert.ok(CHAT_SPEC.includes("page_to"));
  assert.ok(CHAT_SPEC.includes("./common.yaml#/components/schemas/ApiFailureResponse"));
});

test("internal evidence contract scopes retrieval and versions the reranker", () => {
  assert.ok(RETRIEVAL_SPEC.includes("tenant_id"));
  assert.ok(RETRIEVAL_SPEC.includes("course_id"));
  assert.ok(RETRIEVAL_SPEC.includes("user_id"));
  assert.ok(RETRIEVAL_SPEC.includes("evidence_id"));
  assert.ok(RETRIEVAL_SPEC.includes("reranker_version"));
  assert.ok(RETRIEVAL_SPEC.includes("enum: [base, finetuned]"));
  assert.ok(RETRIEVAL_SPEC.includes("serviceBearerAuth"));
});
