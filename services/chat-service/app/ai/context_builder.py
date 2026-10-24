"""Builds prompt context from validated evidence chunks."""
from typing import List, Any


class ContextBuilder:
    """Builds formatted prompt context from validated evidence chunks."""

    @staticmethod
    def build_context(evidence_list: List[Any]) -> str:
        valid_list = [ev for ev in (evidence_list or []) if ev is not None]
        if not valid_list:
            return ""

        parts = []
        for idx, ev in enumerate(valid_list, 1):
            if isinstance(ev, dict):
                source = ev.get("documentName") or ev.get("document_name") or ev.get("source_title") or "Unknown"
                content = ev.get("text") or ev.get("content") or ""
                p_from = ev.get("pageFrom") or ev.get("page_from") or ev.get("page_number") or 1
                p_to = ev.get("pageTo") or ev.get("page_to") or p_from
            else:
                source = getattr(ev, "document_name", None) or getattr(ev, "source_title", "Unknown")
                content = getattr(ev, "text", None) or getattr(ev, "content", "")
                p_from = getattr(ev, "page_from", None) or getattr(ev, "page_number", 1)
                p_to = getattr(ev, "page_to", None) or p_from

            source = str(source or "Unknown")
            content = str(content or "")
            try:
                p_from_int = max(1, int(float(p_from)))
            except (ValueError, TypeError):
                p_from_int = 1
            try:
                p_to_int = max(p_from_int, int(float(p_to)))
            except (ValueError, TypeError):
                p_to_int = p_from_int

            page_info = f"Page {p_from_int}" if p_from_int == p_to_int else f"Pages {p_from_int}-{p_to_int}"
            parts.append(f"[{idx}] Source: {source} ({page_info})\nContent: {content}\n")

        return "\n".join(parts)
