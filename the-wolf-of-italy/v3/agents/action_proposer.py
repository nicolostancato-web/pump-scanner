"""ACTION-PROPOSER-1 task string."""
from datetime import datetime
from pathlib import Path

DATE = datetime.now().strftime("%Y-%m-%d")
KB = "the-wolf-of-italy/knowledge_base"


def task() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "action_proposer.md"
    workflow = prompt_path.read_text() if prompt_path.exists() else ""
    return f"""You are ACTION-PROPOSER-1. Date: {DATE}.

{workflow}

Execute now. Read CEO decision_log and eligibility_scores (2 fetch_url calls),
write proposal file, then call send_proposal_email.
If CEO decision says "no action today": save a brief file noting that, do NOT send an email.
"""
