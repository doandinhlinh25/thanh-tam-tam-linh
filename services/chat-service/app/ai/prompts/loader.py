"""Prompt template loader from markdown template files."""
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "versions"

def load_prompt(version: str, name: str) -> str:
    path = PROMPTS_DIR / version / f"{name}.md"
    return path.read_text(encoding="utf-8")
