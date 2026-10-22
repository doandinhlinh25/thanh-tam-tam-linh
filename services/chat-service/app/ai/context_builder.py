"""Builds prompt context from validated evidence chunks."""

class ContextBuilder:
    @staticmethod
    def build_context(evidence_list: list) -> str:
        parts = []
        for idx, ev in enumerate(evidence_list, 1):
            parts.append(f"[{idx}] Source: {ev.source_title}\nContent: {ev.content}\n")
        return "\n".join(parts)
