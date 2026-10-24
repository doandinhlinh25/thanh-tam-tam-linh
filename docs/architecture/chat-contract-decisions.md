# Chat/RAG contract — draft for review

**Status:** Draft for cross-member review; not yet an agreed implementation contract.  
**Owner:** Người 4 — RAG, Chat & Evaluation Lead.

## What this change establishes

- Public Chat API and the shared ApiResponse success/failure envelope.
- Conversation listing/history, feedback upsert, and deletion of Chat-owned conversation data.
- Explicit result states: answered and insufficient_evidence.
- Server-derived citations with document source type and page range.
- Internal retrieval and reranker request/response shapes for review with Người 3.
- Request correlation, pipeline variant/version metadata, and stable technical-error behavior.

## Important contract rules

1. A successful chat result is either answered or insufficient_evidence. Technical failures use a non-2xx HTTP status with ApiFailureResponse; they must not be disguised as insufficient evidence.
2. An answered result has at least one citation. An insufficient_evidence result has an empty citation list and must not make unsupported factual claims.
3. Citation IDs, document names, page ranges, source types and snippets are built from the server-side evidence snapshot. Never trust citation metadata returned by the LLM.
4. Public requests do not accept tenant_id or user_id as authorization proof. Chat derives identity from trusted session context, checks course access, and passes trusted identifiers to retrieval.
5. Conversation and message lookups are owner-scoped. Return 404 for resources that do not exist or are not visible to the caller.
6. Retrieval filters tenant/course/document ACL before candidates leave the retrieval owner. Combined mode may include only the caller's own personal documents.
7. Variant A is dense retrieval only; B uses the baseline reranker; C uses the fine-tuned reranker. Compare all variants on the same evaluation set and fixed configuration.

## Compatibility decision that needs review

The handbook's earlier proposal uses POST /courses/{courseId}/chat. The newer SRS v0.2 also includes personal-document-only and combined retrieval. This draft preserves the course endpoint, supports course_only and combined there, and adds POST /personal-documents/chat for personal-only questions. Confirm this route split with Người 1 and Người 3 before implementation.

## Decisions still pending

| Owner | Item to confirm | Draft value in the contract |
| --- | --- | --- |
| Người 2 | Actual session cookie name and CSRF protection | saas_session and X-CSRF-Token are placeholders only |
| Người 2 | Internal service authentication and rotation | Bearer service credential is provisional |
| Người 2 | Quota error code, retry behavior, and limits | HTTP 429; exact quota policy remains external to this contract |
| Người 3 | Retrieval endpoint, ACL filtering, evidence ID lifetime, and document version behavior | See retrieval-evidence.yaml; evidence IDs are request-scoped |
| Người 3 | Candidate count and reranker input/output details | candidate_k=20, maximum 100, both provisional |
| Người 1 | Frontend payload naming, citation click-through, and feedback UX | Snake_case payloads; positive/negative feedback |
| Product/lecturer | Maximum question length | 4000 characters is a provisional guardrail |
| Product/lecturer | Personal-data retention and deletion semantics for backups/audit logs | The API deletes Chat-owned conversation data only; organization-wide policy must define the rest |

## Implementation acceptance checklist

- [ ] Person 1, 2 and 3 review the public/internal contracts.
- [ ] Cookie/CSRF and service-to-service authentication are confirmed before routes are protected.
- [ ] Course access, tenant isolation, conversation ownership and personal-document ownership are enforced server-side.
- [ ] Answered responses contain only validated citations from the evidence snapshot.
- [ ] Insufficient-evidence responses contain no citations and do not call the LLM unnecessarily.
- [ ] Provider timeout, 429, invalid output, retrieval outage and reranker outage remain technical failures.
- [ ] Delete behavior is tested for messages, citations and feedback; source documents are deleted by Document Service.
- [ ] OpenAPI linting and generated-client compatibility are added to CI before the contract is treated as stable.
