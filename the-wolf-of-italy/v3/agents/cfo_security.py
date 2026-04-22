"""CFO-SECURITY-1 task string."""
from datetime import datetime
from pathlib import Path

DATE = datetime.now().strftime("%Y-%m-%d")
KB = "the-wolf-of-italy/knowledge_base"


def task() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "cfo_security.md"
    workflow = prompt_path.read_text() if prompt_path.exists() else ""
    return f"""You are CFO-SECURITY-1. Date: {DATE}.

{workflow}

Execute now. Call get_sol_balance, get_token_accounts, get_recent_transactions,
then fetch SOL price and protocol TVLs (max 4 fetch_url calls),
then save wallet snapshot. Max 8 tool calls total.
"""
