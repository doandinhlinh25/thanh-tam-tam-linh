"""Chat service orchestrating RAG query workflow and persistence."""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Callable

from app.core.exceptions import NotFoundException, ConflictException
from app.domain.entities.conversation import Conversation
from app.domain.entities.message import Message
from app.domain.value_objects.citation import ChatCitation
from app.domain.value_objects.tenant_context import TenantContext
from app.domain.repositories.conversation_repository import IConversationRepository
from app.domain.repositories.message_repository import IMessageRepository
from app.ai.pipeline import AIPipeline, PipelineResult
from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
from app.integrations.database.unit_of_work import UnitOfWork


@dataclass
class ChatServiceResult(PipelineResult):
    """Result object bridging PipelineResult and OpenAPI response envelope."""
    request_id: str = ""
    conversation_id: str = ""
    message_id: str = ""
    source_scope: str = "course_only"
    status: str = "answered"
    successful: bool = True
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[Any] = None
    refused: bool = False
    refusal_reason: Optional[str] = None

    def __getitem__(self, item: str) -> Any:
        if item in (
            "successful",
            "data",
            "error",
            "conversation_id",
            "message_id",
            "refused",
            "refusal_reason",
            "source_scope",
            "request_id",
        ):
            return getattr(self, item)
        return super().__getitem__(item)

    def to_envelope(self) -> Dict[str, Any]:
        return {
            "successful": self.successful,
            "data": self.data,
            "error": self.error,
        }


def _get_attr_or_key(obj: Any, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if isinstance(obj, dict):
            if k in obj and obj[k] is not None:
                return obj[k]
        elif hasattr(obj, k):
            v = getattr(obj, k)
            if v is not None:
                return v
    return default


def _generate_title(question: str) -> str:
    cleaned = " ".join(question.strip().split())
    if not cleaned:
        return "Cuộc trò chuyện mới"
    if len(cleaned) <= 50:
        return cleaned
    return cleaned[:47] + "..."


class ChatService:
    """Coordinates context retrieval, evidence gating, LLM response, citation validation, and persistence."""

    def __init__(
        self,
        pipeline: Optional[AIPipeline] = None,
        uow: Optional[UnitOfWork] = None,
        conversation_repo: Optional[IConversationRepository] = None,
        message_repo: Optional[IMessageRepository] = None,
        session_factory: Optional[Callable] = None,
    ):
        self.pipeline = pipeline or AIPipeline()
        self.uow = uow
        self.conversation_repo = conversation_repo
        self.message_repo = message_repo
        self.session_factory = session_factory or AsyncSessionLocal

    async def answer_question(
        self,
        context: TenantContext,
        question: str,
        conversation_id: Optional[str] = None,
        source_scope: Optional[str] = None,
    ) -> ChatServiceResult:
        """Answer user question using RAG AI pipeline with persistence."""
        scope = source_scope or "course_only"
        active_conv_id = conversation_id or getattr(context, "conversation_id", None)

        session_to_close = None
        conv_repo = self.conversation_repo
        msg_repo = self.message_repo
        active_uow = self.uow

        if not conv_repo or not msg_repo:
            if active_uow:
                conv_repo = active_uow.conversations
                msg_repo = active_uow.messages
            else:
                try:
                    await ensure_db_initialized()
                    session = self.session_factory()
                    session_to_close = session
                    active_uow = UnitOfWork(session)
                    conv_repo = active_uow.conversations
                    msg_repo = active_uow.messages
                except Exception:
                    # If database is completely unavailable and not configured, run pipeline only
                    conv_repo = None
                    msg_repo = None

        try:
            # 1. Resolve or create conversation
            conv = None
            if active_conv_id and conv_repo:
                conv = await conv_repo.get_by_id(
                    conversation_id=active_conv_id,
                    tenant_id=context.tenant_id,
                    user_id=context.user_id,
                )
                if not conv:
                    raise NotFoundException(f"Conversation {active_conv_id} not found")
                if conv.course_id != context.course_id:
                    raise ConflictException(
                        f"Conversation {active_conv_id} course ({conv.course_id}) does not match requested course ({context.course_id})"
                    )
                conv_scope = getattr(conv, "source_scope", None) or "course_only"
                if conv_scope and scope and conv_scope != scope:
                    raise ConflictException(
                        f"Conversation {active_conv_id} source scope ({conv_scope}) does not match requested source scope ({scope})"
                    )
            elif not active_conv_id:
                active_conv_id = f"conv-{uuid.uuid4().hex[:12]}"
                if conv_repo:
                    now = datetime.now(timezone.utc)
                    conv = Conversation(
                        id=active_conv_id,
                        tenant_id=context.tenant_id,
                        user_id=context.user_id,
                        course_id=context.course_id,
                        source_scope=scope,
                        title=_generate_title(question),
                        created_at=now,
                        updated_at=now,
                    )
                    await conv_repo.save(conv)

            # 2. Persist incoming user question
            user_msg_id = f"msg-{uuid.uuid4().hex[:12]}"
            if msg_repo:
                user_msg = Message(
                    id=user_msg_id,
                    conversation_id=active_conv_id,
                    role="user",
                    content=question,
                    created_at=datetime.now(timezone.utc),
                )
                await msg_repo.save(user_msg)

            # 3. Execute AIPipeline.run()
            pipeline_res = await self.pipeline.run(user_query=question, tenant_context=context)

            # 4. Persist assistant response and citations
            asst_msg_id = f"msg-{uuid.uuid4().hex[:12]}"
            status = pipeline_res.result_state
            is_refused = (status == "insufficient_evidence")
            refusal_reason = "insufficient_evidence" if is_refused else None
            now = datetime.now(timezone.utc)

            if msg_repo:
                asst_msg = Message(
                    id=asst_msg_id,
                    conversation_id=active_conv_id,
                    role="assistant",
                    content=pipeline_res.answer,
                    refused=is_refused,
                    refusal_reason=refusal_reason,
                    citations=pipeline_res.citations,
                    status=status,
                    created_at=now,
                )
                await msg_repo.save(asst_msg)

            # Update conversation timestamp
            if conv and conv_repo:
                conv.last_message_at = now
                conv.updated_at = now
                await conv_repo.save(conv)

            if active_uow:
                await active_uow.commit()

            # 5. Build OpenAPI response envelope
            formatted_citations = []
            for c in pipeline_res.citations:
                ev_id = _get_attr_or_key(c, "evidence_id", "chunk_id", "evidenceId", default="")
                doc_name = _get_attr_or_key(c, "document_name", "title", "documentName", default="")
                p_from = _get_attr_or_key(c, "page_from", "page_number", "pageFrom", default=1)
                p_to = _get_attr_or_key(c, "page_to", "page_number", "pageTo", default=p_from)
                cit_id = _get_attr_or_key(c, "citation_id", "citationId", default=f"cit-{ev_id}")
                src_type = _get_attr_or_key(c, "source_type", "sourceType", default="official")
                doc_id = _get_attr_or_key(c, "document_id", "documentId", default="")
                snippet = _get_attr_or_key(c, "snippet", default="")
                formatted_citations.append(
                    {
                        "citation_id": cit_id,
                        "evidence_id": ev_id,
                        "source_type": src_type,
                        "document_id": doc_id,
                        "document_name": doc_name,
                        "page_from": p_from,
                        "page_to": p_to,
                        "snippet": snippet,
                        # For backward compatibility
                        "chunk_id": ev_id,
                        "title": doc_name,
                        "page_number": p_from,
                    }
                )

            req_id = getattr(context, "request_id", None) or f"req-{uuid.uuid4().hex[:12]}"
            data_envelope = {
                "request_id": req_id,
                "conversation_id": active_conv_id,
                "message_id": asst_msg_id,
                "status": status,
                "source_scope": scope,
                "answer": pipeline_res.answer,
                "citations": formatted_citations,
                "pipeline": pipeline_res.metadata,
            }

            return ChatServiceResult(
                result_state=pipeline_res.result_state,
                answer=pipeline_res.answer,
                citations=pipeline_res.citations,
                metadata=pipeline_res.metadata,
                request_id=req_id,
                conversation_id=active_conv_id,
                message_id=asst_msg_id,
                source_scope=scope,
                status=status,
                successful=True,
                data=data_envelope,
                error=None,
                refused=is_refused,
                refusal_reason=refusal_reason,
            )
        except Exception:
            if active_uow:
                await active_uow.rollback()
            raise
        finally:
            if session_to_close:
                await session_to_close.close()

    async def close(self) -> None:
        """Close underlying pipeline resources."""
        if hasattr(self.pipeline, "close"):
            await self.pipeline.close()

    async def aclose(self) -> None:
        """Alias for close()."""
        await self.close()

    async def __aenter__(self) -> "ChatService":
        return self

    async def __aexit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        await self.close()
