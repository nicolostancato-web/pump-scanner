"""CFO agent task string."""

from datetime import datetime
from pathlib import Path

DATE = datetime.now().strftime("%Y-%m-%d")


def task(daily_report: bool = False) -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "cfo.md"
    prompt = prompt_path.read_text() if prompt_path.exists() else ""
    result = prompt.replace("[DATE]", DATE)
    if daily_report:
        result += "\n\nNOTA: Questo run genera il daily_report.md. DAILY_REPORT=true."
    return result
