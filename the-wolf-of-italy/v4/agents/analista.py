"""ANALISTA agent task string."""

from datetime import datetime
from pathlib import Path

DATE = datetime.now().strftime("%Y-%m-%d")


def task(reset_mode: bool = False) -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "analista.md"
    prompt = prompt_path.read_text() if prompt_path.exists() else ""
    result = prompt.replace("[DATE]", DATE)
    if reset_mode:
        result += "\n\nNOTA: Questo run è il reset serale. RESET_MODE=true."
    return result
