export type PageId = "overview" | "documents" | "evaluation" | "feedback" | "courses" | "settings";

export type DemoRole = "student" | "teacher" | "admin";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: DemoRole;
  courseIds: string[];
}

export interface DemoAccount extends DemoUser {
  password: string;
}

export interface MockCitation {
  id: string;
  documentId: string;
  documentName: string;
  page: number;
  snippet: string;
}

export type ChatResultStatus = "answered" | "insufficient_evidence" | "error";

export interface ChatMessage {
  id: string;
  author: "student" | "assistant";
  text: string;
  createdAt: string;
  status?: ChatResultStatus;
  citations?: MockCitation[];
  rating?: "positive" | "negative";
}

export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export interface LearningDocument {
  id: string;
  name: string;
  courseId: string;
  format: "PDF" | "DOCX";
  size: string;
  status: DocumentStatus;
  uploadedAt: string;
  processedAt?: string;
  chunks: number;
  pages: number;
  extractedText: string;
  error?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description: string;
  documentCount: number;
  studentCount: number;
  updatedAt: string;
}

export interface EvaluationQuestion {
  id: string;
  question: string;
  referenceAnswer: string;
  evidence: string;
  answerable: boolean;
  score: number;
}

export interface FeedbackItem {
  id: string;
  student: string;
  course: string;
  question: string;
  answer: string;
  source: string;
  rating: "positive" | "negative";
  category: string;
  createdAt: string;
}

export interface EvaluationSummary {
  setName: string;
  lastRun: string;
  recall: number;
  answerQuality: number;
  citationAccuracy: number;
  refusalAccuracy: number;
  history: number[];
}

export interface SystemSettings {
  llmModel: string;
  embeddingModel: string;
  topK: number;
  chunkSize: number;
  overlap: number;
  retrievalThreshold: number;
  refusalEnabled: boolean;
}
