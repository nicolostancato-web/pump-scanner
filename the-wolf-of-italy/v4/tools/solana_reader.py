"""
Solana blockchain reader — public RPC, read-only.
Never asks for or stores private keys.
"""

import httpx

SOLANA_RPC = "https://api.mainnet-beta.solana.com"
HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=public"


async def _rpc(method: str, params: list) -> dict:
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    async with httpx.AsyncClient(timeout=20) as http:
        for rpc_url in [SOLANA_RPC, HELIUS_RPC]:
            try:
                r = await http.post(rpc_url, json=payload)
                r.raise_for_status()
                data = r.json()
                if "error" not in data:
                    return data.get("result", {})
            except Exception:
                continue
    return {"error": "All RPC endpoints failed"}


async def get_sol_balance(wallet: str) -> dict:
    """Return SOL balance in lamports and SOL."""
    result = await _rpc("getBalance", [wallet])
    if "error" in result:
        return result
    lamports = result.get("value", 0)
    return {
        "wallet": wallet,
        "lamports": lamports,
        "sol": lamports / 1_000_000_000,
    }


async def get_token_accounts(wallet: str) -> dict:
    """Return all SPL token accounts with parsed balances."""
    result = await _rpc(
        "getTokenAccountsByOwner",
        [
            wallet,
            {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
            {"encoding": "jsonParsed"},
        ],
    )
    if "error" in result:
        return result
    accounts = []
    for item in result.get("value", []):
        info = item.get("account", {}).get("data", {}).get("parsed", {}).get("info", {})
        mint = info.get("mint", "")
        balance = info.get("tokenAmount", {})
        accounts.append({
            "mint": mint,
            "amount": balance.get("uiAmountString", "0"),
            "decimals": balance.get("decimals", 0),
        })
    return {"wallet": wallet, "tokens": accounts, "count": len(accounts)}


async def get_recent_transactions(wallet: str, limit: int = 10) -> dict:
    """Return recent transaction signatures to verify on-chain activity."""
    result = await _rpc(
        "getSignaturesForAddress",
        [wallet, {"limit": min(limit, 20)}],
    )
    if isinstance(result, dict) and "error" in result:
        return result
    txs = []
    for tx in (result or []):
        txs.append({
            "signature": tx.get("signature", ""),
            "slot": tx.get("slot", 0),
            "blockTime": tx.get("blockTime", 0),
            "err": tx.get("err"),
        })
    return {"wallet": wallet, "transactions": txs, "count": len(txs)}
