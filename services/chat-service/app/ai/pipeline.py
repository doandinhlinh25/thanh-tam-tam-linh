"""End-to-end RAG AI Pipeline orchestration."""
import time
from dataclasses import dataclass, field
from typing import Optional, List, Any, Union

from app.domain.value_objects.citation import ChatCitation
from app.domain.value_objects.tenant_context import TenantContext
from app.ai.retrieval.client import RetrievalClient
from app.ai.retrieval.schemas import SearchRequest
from app.ai.evidence_gate import EvidenceGate
from app.ai.context_builder import ContextBuilder
from app.ai.citation_validator import CitationValidator
from app.ai.answer_validator import AnswerValidator
from app.ai.refusal_policy import RefusalPolicy
from app.ai.prompts.loader import load_prompt
from app.ai.llm.base import BaseLLMProvider
from app.ai.llm.factory import LLMFactory
from app.ai.llm.schemas import LLMRequest, LLMMessage


@dataclass
class PipelineResult:
    """Structured result returned by AIPipeline."""
    result_state: str  # "answered" | "insufficient_evidence"
    answer: str
    citations: List[ChatCitation] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def status(self) -> str:
        return self.result_state

    @property
    def answer_text(self) -> str:
        return self.answer

    def __getitem__(self, item: str) -> Any:
        if item == "result_state":
            return self.result_state
        if item == "status":
            return self.status
        if item == "answer":
            return self.answer
        if item == "citations":
            return self.citations
        if item == "metadata":
            return self.metadata
        raise KeyError(item)

    def to_dict(self) -> dict[str, Any]:
        return {
            "result_state": self.result_state,
            "status": self.result_state,
            "answer": self.answer,
            "citations": [c.to_dict() if hasattr(c, "to_dict") else c for c in self.citations],
            "metadata": self.metadata,
        }


class AIPipeline:
    """Orchestrates retrieval, evidence gating, LLM inference, and citation validation."""

    def __init__(
        self,
        retrieval_client: Optional[RetrievalClient] = None,
        evidence_gate: Optional[EvidenceGate] = None,
        context_builder: Optional[ContextBuilder] = None,
        citation_validator: Optional[CitationValidator] = None,
        answer_validator: Optional[AnswerValidator] = None,
        llm_provider: Optional[BaseLLMProvider] = None,
        min_confidence: float = 0.65,
    ):
        self.retrieval_client = retrieval_client or RetrievalClient()
        self.evidence_gate = evidence_gate or EvidenceGate(min_confidence=min_confidence)
        self.context_builder = context_builder or ContextBuilder()
        self.citation_validator = citation_validator or CitationValidator()
        self.answer_validator = answer_validator or AnswerValidator()
        self._llm_provider = llm_provider
        self.min_confidence = min_confidence

    @property
    def llm_provider(self) -> BaseLLMProvider:
        if self._llm_provider is None:
            self._llm_provider = LLMFactory.get_provider()
        return self._llm_provider

    async def run(
        self, user_query: str, tenant_context: Union[TenantContext, dict[str, Any]]
    ) -> PipelineResult:
        """Execute end-to-end RAG pipeline with evidence gating and citation validation."""
        start_time = time.perf_counter()

        # 1. Parse tenant context
        if not user_query or not user_query.strip():
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return PipelineResult(
                result_state="insufficient_evidence",
                answer=RefusalPolicy.get_refusal("empty_query"),
                citations=[],
                metadata={
                    "result_state": "insufficient_evidence",
                    "reason": "empty_query",
                    "variant": "A",
                    "retriever_version": "v1.0",
                    "reranker_version": None,
                    "llm_model": None,
                    "prompt_version": None,
                    "candidates_count": 0,
                    "min_confidence": self.min_confidence,
                    "latency_ms": latency_ms,
                    "llm_called": False,
                },
            )

        if tenant_context is None:
            tenant_id, course_id, user_id = "", "", ""
        elif isinstance(tenant_context, dict):
            tenant_id = str(tenant_context.get("tenant_id") or tenant_context.get("tenantId") or "")
            course_id = str(tenant_context.get("course_id") or tenant_context.get("courseId") or "")
            user_id = str(tenant_context.get("user_id") or tenant_context.get("actorUserId") or "")
        else:
            tenant_id = str(getattr(tenant_context, "tenant_id", ""))
            course_id = str(getattr(tenant_context, "course_id", "") or "")
            user_id = str(getattr(tenant_context, "user_id", ""))

        # 2. Fetch candidates via RetrievalClient
        search_req = SearchRequest(
            tenant_id=tenant_id,
            course_id=course_id,
            actor_user_id=user_id,
            query=user_query,
            candidate_k=8,
        )
        candidates = await self.retrieval_client.retrieve(search_req)

        # 3. Evaluate via EvidenceGate
        if not self.evidence_gate.evaluate(candidates):
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return PipelineResult(
                result_state="insufficient_evidence",
                answer=RefusalPolicy.get_refusal("insufficient_evidence"),
                citations=[],
                metadata={
                    "result_state": "insufficient_evidence",
                    "reason": "insufficient_evidence",
                    "variant": "A",
                    "retriever_version": "v1.0",
                    "reranker_version": None,
                    "llm_model": None,
                    "prompt_version": None,
                    "candidates_count": len(candidates) if candidates else 0,
                    "min_confidence": self.min_confidence,
                    "latency_ms": latency_ms,
                    "llm_called": False,
                },
            )

        # 4. Filter confident evidence and build context
        filtered_candidates = (
            self.evidence_gate.filter_evidence(candidates)
            if hasattr(self.evidence_gate, "filter_evidence")
            else candidates
        )
        if not filtered_candidates:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return PipelineResult(
                result_state="insufficient_evidence",
                answer=RefusalPolicy.get_refusal("insufficient_evidence"),
                citations=[],
                metadata={
                    "result_state": "insufficient_evidence",
                    "reason": "insufficient_evidence",
                    "variant": "A",
                    "retriever_version": "v1.0",
                    "reranker_version": None,
                    "llm_model": None,
                    "prompt_version": None,
                    "candidates_count": 0,
                    "min_confidence": self.min_confidence,
                    "latency_ms": latency_ms,
                    "llm_called": False,
                },
            )

        context = self.context_builder.build_context(filtered_candidates)

        # 5. Format system and answer prompts via PromptLoader
        system_prompt = load_prompt("v1", "system")
        answer_template = load_prompt("v1", "answer")
        user_prompt = (
            answer_template
            .replace("{{ context }}", context)
            .replace("{{context}}", context)
            .replace("{{ question }}", user_query)
            .replace("{{question}}", user_query)
        )

        # 6. Invoke LLM provider
        llm_request = LLMRequest(
            messages=[
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_prompt),
            ],
            temperature=0.1,
        )
        llm_response = await self.llm_provider.generate(llm_request)
        raw_answer = (
            llm_response.content
            if hasattr(llm_response, "content")
            else getattr(llm_response, "text", str(llm_response))
        )
        answer_text = str(raw_answer or "").strip()

        # 7. Validate answer boundary & citations
        is_valid_answer = self.answer_validator.validate(answer_text, context)
        is_valid_citations = self.citation_validator.validate_citations(answer_text, filtered_candidates)

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        if not is_valid_answer or not is_valid_citations:
            return PipelineResult(
                result_state="insufficient_evidence",
                answer=RefusalPolicy.get_refusal("validation_failed"),
                citations=[],
                metadata={
                    "result_state": "insufficient_evidence",
                    "reason": "validation_failed",
                    "variant": "A",
                    "retriever_version": "v1.0",
                    "reranker_version": None,
                    "llm_model": getattr(llm_response, "model", "gpt-4o"),
                    "prompt_version": "v1",
                    "answer_valid": is_valid_answer,
                    "citations_valid": is_valid_citations,
                    "latency_ms": latency_ms,
                    "llm_called": True,
                },
            )

        # 8. Build ChatCitation objects
        citations = self.citation_validator.build_citations(answer_text, filtered_candidates)

        return PipelineResult(
            result_state="answered",
            answer=answer_text,
            citations=citations,
            metadata={
                "result_state": "answered",
                "variant": "A",
                "retriever_version": "v1.0",
                "reranker_version": None,
                "llm_model": getattr(llm_response, "model", "gpt-4o"),
                "prompt_version": "v1",
                "model": getattr(llm_response, "model", "gpt-4o"),
                "prompt_tokens": getattr(llm_response, "prompt_tokens", 0),
                "completion_tokens": getattr(llm_response, "completion_tokens", 0),
                "total_tokens": getattr(llm_response, "total_tokens", 0),
                "candidates_count": len(filtered_candidates),
                "latency_ms": latency_ms,
                "llm_called": True,
            },
        )

    async def close(self) -> None:
        """Close underlying retrieval client and resources."""
        if hasattr(self.retrieval_client, "close"):
            await self.retrieval_client.close()

    async def aclose(self) -> None:
        """Alias for close()."""
        await self.close()

    async def __aenter__(self) -> "AIPipeline":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()
