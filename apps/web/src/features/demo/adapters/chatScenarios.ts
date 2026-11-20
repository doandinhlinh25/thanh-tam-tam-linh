import { demoChatAnswers, demoChatErrorScenarios, demoPersonalDocumentAnswer } from "./demoData";
import type { DemoChatContext, DemoChatErrorKind, MockCitation } from "../../../shared/domain/types";

export type DemoChatResult = { demoContext: DemoChatContext; demoOnly: true } & (
  | { status: "answered"; text: string; citations: MockCitation[] }
  | { status: "insufficient_evidence"; text: string; citations: [] }
  | { status: "error"; text: string; errorKind: DemoChatErrorKind; retryable: boolean; citations: [] }
);

const insufficientEvidenceText = "Mình chưa tìm thấy đủ thông tin trong tài liệu mẫu của môn học này để trả lời chính xác. Hãy thử hỏi về nội dung đã có trong học liệu.";

export function getDemoChatResult(context: DemoChatContext, question: string, hasPersonalDocuments: boolean, isRetry = false): DemoChatResult {
  // Copy context so delayed fixture results keep their originating scope.
  const metadata = { demoContext: { ...context }, demoOnly: true as const };
  const normalized = question.trim().toLocaleLowerCase("vi");
  const errorKind = normalized.includes("mô phỏng lỗi quyền demo") ? "permission"
    : normalized.includes("mô phỏng lỗi phụ thuộc demo") ? "dependency" : "technical";
  const requestsError = normalized.includes("lỗi demo") || normalized.includes("mô phỏng lỗi");
  const errorScenario = demoChatErrorScenarios[errorKind];
  if (requestsError && (!isRetry || !errorScenario.retryable)) return { ...metadata, status: "error", errorKind, text: errorScenario.text, retryable: errorScenario.retryable, citations: [] };
  if (hasPersonalDocuments && demoPersonalDocumentAnswer.keywords.some((keyword) => normalized.includes(keyword))) return { ...metadata, status: "answered", text: demoPersonalDocumentAnswer.answer, citations: demoPersonalDocumentAnswer.citations };
  const scenario = demoChatAnswers[context.courseId];
  if (scenario && scenario.keywords.some((keyword) => normalized.includes(keyword))) return { ...metadata, status: "answered", text: scenario.answer, citations: scenario.citations };
  return { ...metadata, status: "insufficient_evidence", text: insufficientEvidenceText, citations: [] };
}
