"""AIRDROP-HUNTER-1 task string."""
from datetime import datetime
from pathlib import Path

DATE = datetime.now().strftime("%Y-%m-%d")
NOTES = "the-wolf-of-italy/team-notes"


def task() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "airdrop_hunter.md"
    workflow = prompt_path.read_text() if prompt_path.exists() else ""
    return f"""You are AIRDROP-HUNTER-1. Date: {DATE}.

{workflow}

Execute now. Make at most 6 fetch_url calls total. After completing the 4 protocol checks,
save raw_notes immediately. Do not do more research after saving.
"""
