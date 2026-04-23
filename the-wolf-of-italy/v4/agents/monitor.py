"""MONITOR agent task string."""

from datetime import datetime
from pathlib import Path

DATE = datetime.now().strftime("%Y-%m-%d")


def task() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "monitor.md"
    prompt = prompt_path.read_text() if prompt_path.exists() else ""
    return prompt.replace("[DATE]", DATE)
