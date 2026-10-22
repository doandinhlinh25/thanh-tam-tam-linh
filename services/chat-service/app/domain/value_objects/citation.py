"""Citation value object linking answer statements to source chunks."""
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class Citation:
    document_id: str
    chunk_id: str
    title: str
    snippet: str
    page_number: Optional[int] = None
