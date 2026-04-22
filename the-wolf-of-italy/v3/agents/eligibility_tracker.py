"""ELIGIBILITY-TRACKER-1 task string."""
from datetime import datetime
from pathlib import Path

DATE = datetime.now().strftime("%Y-%m-%d")
KB = "the-wolf-of-italy/knowledge_base"


def task() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "eligibility_tracker.md"
    workflow = prompt_path.read_text() if prompt_path.exists() else ""
    return f"""You are ELIGIBILITY-TRACKER-1. Date: {DATE}.

{workflow}

Execute now. Call get_sol_balance, get_token_accounts, get_recent_transactions —
then 1 fetch_url for AIRDROP-HUNTER-1 notes — then save eligibility scores immediately.
Max 4 tool calls total before saving.
"""
