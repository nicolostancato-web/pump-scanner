"""
Web scraper — httpx + BeautifulSoup for HTML parsing.
Used by HUNTER to extract opportunity data from sources.
"""

import re
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


async def fetch_text(url: str, max_chars: int = 8000) -> str:
    """Fetch URL and return plain text (stripped HTML). For LLM consumption."""
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=HEADERS) as http:
        try:
            r = await http.get(url)
            r.raise_for_status()
            ct = r.headers.get("content-type", "")
            if "json" in ct:
                return r.text[:max_chars]
            parser = "lxml" if __import__("importlib").util.find_spec("lxml") else "html.parser"
            soup = BeautifulSoup(r.text, parser)
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            lines = [l for l in text.splitlines() if len(l.strip()) > 20]
            return "\n".join(lines)[:max_chars]
        except Exception as e:
            return f"Error fetching {url}: {e}"


async def fetch_json(url: str, extra_headers: dict | None = None) -> dict | list | str:
    """Fetch JSON from URL."""
    h = {**HEADERS, **(extra_headers or {})}
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=h) as http:
        try:
            r = await http.get(url)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            return {"error": str(e)}


async def search_defillama_protocol(name: str) -> dict:
    """Quick TVL lookup for a protocol on DeFiLlama."""
    slug = name.lower().replace(" ", "-")
    data = await fetch_json(f"https://api.llama.fi/tvl/{slug}")
    if isinstance(data, (int, float)):
        return {"protocol": name, "tvl_usd": float(data), "slug": slug}
    data2 = await fetch_json(f"https://api.llama.fi/protocol/{slug}")
    if isinstance(data2, dict) and "tvl" in data2:
        tvl = data2["tvl"]
        if isinstance(tvl, list) and tvl:
            return {"protocol": name, "tvl_usd": float(tvl[-1].get("totalLiquidityUSD", 0)), "slug": slug}
    return {"protocol": name, "tvl_usd": None, "slug": slug, "error": "not found on DeFiLlama"}


def extract_sol_amount(text: str) -> float | None:
    """Extract first SOL amount from text like '0.15 SOL' or '$13.50'."""
    m = re.search(r"(\d+\.?\d*)\s*SOL", text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    m = re.search(r"\$(\d+\.?\d*)", text)
    if m:
        return float(m.group(1))
    return None
