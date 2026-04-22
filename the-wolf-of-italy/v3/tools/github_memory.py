"""
GitHub knowledge base reader/writer.
Wraps GitHub Contents API for the pump-scanner repo.
"""

import base64
import os
import httpx

REPO = os.environ.get("GITHUB_REPO", "nicolostancato-web/pump-scanner")
BASE_URL = "https://api.github.com/repos"


def _headers() -> dict:
    token = os.environ.get("GITHUB_TOKEN", "")
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }


async def kb_read(path: str) -> dict:
    """Read a file from knowledge_base. Returns decoded content."""
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.get(f"{BASE_URL}/{REPO}/contents/{path}", headers=_headers())
        if r.status_code == 404:
            return {"ok": False, "error": "file not found", "path": path}
        r.raise_for_status()
        data = r.json()
        content = base64.b64decode(data["content"]).decode("utf-8")
        return {"ok": True, "path": path, "content": content, "sha": data["sha"]}


async def kb_list(path: str) -> dict:
    """List files in a knowledge_base folder."""
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.get(f"{BASE_URL}/{REPO}/contents/{path}", headers=_headers())
        if r.status_code == 404:
            return {"ok": False, "error": "folder not found", "path": path}
        r.raise_for_status()
        items = [
            {"name": f["name"], "path": f["path"], "size": f["size"]}
            for f in r.json()
            if f["type"] == "file" and not f["name"].startswith(".")
        ]
        return {"ok": True, "path": path, "files": items, "count": len(items)}


async def kb_write(path: str, content: str, message: str) -> dict:
    """Write a file to knowledge_base. Creates or updates."""
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
    headers = _headers()
    async with httpx.AsyncClient(timeout=20) as http:
        existing = await http.get(f"{BASE_URL}/{REPO}/contents/{path}", headers=headers)
        body = {"message": message, "content": encoded}
        if existing.status_code == 200:
            body["sha"] = existing.json()["sha"]
        r = await http.put(f"{BASE_URL}/{REPO}/contents/{path}", json=body, headers=headers)
        return {
            "ok": r.status_code in (200, 201),
            "status": r.status_code,
            "path": path,
        }
