'use strict';
const https = require('https');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const N8N_WEBHOOK        = 'https://nikbumme.app.n8n.cloud/webhook/dex-scanner';
const MIN_SCORE          = 65;
const SCAN_INTERVAL_MS   = 2 * 60 * 1000;
const MAX_TOKEN_AGE_HRS  = 2;
const MIN_LIQUIDITY_USD  = 10_000;
const WHALE_BONUS        = 25;
const WHALE_ALERT_IMMED  = true;
const WHALE_REFRESH_MS   = 6 * 60 * 60 * 1000;
const WHALE_LEARN_MS     = 30 * 60 * 1000;
const WHALE_LEARN_2X     = 2.0;
const MAX_TRADES_CHECK   = 50;

// ─── STATE ────────────────────────────────────────────────────────────────────
const alertedTokens = new Set();
const seenTokens    = new Map();
let   whaleWallets  = new Set();
let   lastWhaleFetch = 0;

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error for: ' + url)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout: ' + url)); });
  });
}

function httpPost(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout POST')); });
    req.write(body);
    req.end();
  });
}

// ─── WHALE TRACKER ────────────────────────────────────────────────────────────
async function loadWhalesFromGMGN() {
  const now = Date.now();
  if (now - lastWhaleFetch < WHALE_REFRESH_MS) return;

  try {
    const data = await httpGet('https://gmgn.ai/defi/quotation/v1/rank/sol/wallets/7d?limit=100&orderby=pnl_7d&direction=desc');
    const wallets = data?.data?.rank;
    if (Array.isArray(wallets) && wallets.length > 0) {
      wallets.forEach(w => { if (w.wallet_address) whaleWallets.add(w.wallet_address); });
      lastWhaleFetch = now;
      console.log(`🐳 GMGN: loaded ${whaleWallets.size} whale wallets`);
    }
  } catch (e) {
    console.log(`⚠️  GMGN fetch failed: ${e.message} — using existing list (${whaleWallets.size} wallets)`);
  }
}

// ─── GET BUYERS FROM DEXSCREENER TRADES ──────────────────────────────────────
async function getBuyersForPair(pairAddress) {
  try {
    const data = await httpGet(`https://api.dexscreener.com/latest/dex/trades/${pairAddress}`);
    const trades = data?.trades || data;
    if (!Array.isArray(trades)) return [];
    const buyers = [];
    for (const trade of trades.slice(0, MAX_TRADES_CHECK)) {
      if (trade.type === 'buy' && trade.maker) buyers.push(trade.maker);
    }
    return buyers;
  } catch (e) {
    return [];
  }
}

function checkWhaleInBuyers(buyers) {
  for (const wallet of buyers) {
    if (whaleWallets.has(wallet)) return wallet;
  }
  return null;
}

// ─── SCORING ──────────────────────────────────────────────────────────────────
function scoreToken(pair, whaleWallet) {
  let score = 0;
  const reasons = [];

  const ageMin     = pair.ageMinutes || 0;
  const vol5m      = parseFloat(pair.volume?.m5) || 0;
  const vol1h      = parseFloat(pair.volume?.h1) || 0;
  const priceChg5m = parseFloat(pair.priceChange?.m5) || 0;
  const liquidity  = parseFloat(pair.liquidity?.usd) || 0;
  const mcap       = parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 0;
  const buys5m     = pair.txns?.m5?.buys  || 0;
  const sells5m    = pair.txns?.m5?.sells || 0;
  const hasSocials = !!(pair.info?.socials?.length > 0 || pair.info?.websites?.length > 0);

  if (whaleWallet) {
    score += WHALE_BONUS;
    reasons.push(`🐳 Whale wallet: ${whaleWallet.substring(0, 8)}... (+${WHALE_BONUS})`);
  }

  if (ageMin >= 10 && ageMin <= 30)       { score += 15; reasons.push(`⏱️ Età ottimale (${ageMin} min) (+15)`); }
  else if (ageMin > 30 && ageMin <= 60)   { score += 10; reasons.push(`⏱️ Età buona (${ageMin} min) (+10)`); }
  else if (ageMin > 60 && ageMin <= 120)  { score += 5;  reasons.push(`⏱️ Età accettabile (${ageMin} min) (+5)`); }

  if (vol5m >= 50000)      { score += 20; reasons.push(`📈 Volume 5min $${Math.round(vol5m).toLocaleString()} (+20)`); }
  else if (vol5m >= 20000) { score += 15; reasons.push(`📈 Volume 5min $${Math.round(vol5m).toLocaleString()} (+15)`); }
  else if (vol5m >= 10000) { score += 10; reasons.push(`📈 Volume 5min $${Math.round(vol5m).toLocaleString()} (+10)`); }
  else if (vol5m >= 5000)  { score += 5;  reasons.push(`📈 Volume 5min $${Math.round(vol5m).toLocaleString()} (+5)`); }

  const total5m = buys5m + sells5m;
  if (total5m > 0) {
    const ratio5m = buys5m / total5m;
    if (ratio5m >= 0.75)      { score += 15; reasons.push(`🟢 Buy ratio 5min ${Math.round(ratio5m*100)}% (+15)`); }
    else if (ratio5m >= 0.60) { score += 10; reasons.push(`🟢 Buy ratio 5min ${Math.round(ratio5m*100)}% (+10)`); }
    else if (ratio5m >= 0.50) { score += 5;  reasons.push(`🟡 Buy ratio 5min ${Math.round(ratio5m*100)}% (+5)`); }
    else if (ratio5m < 0.35)  { score -= 15; reasons.push(`🔴 Sell pressure 5min ${Math.round((1-ratio5m)*100)}% (-15)`); }
  }

  if (priceChg5m >= 20)      { score += 10; reasons.push(`🚀 Price +${priceChg5m.toFixed(1)}% in 5min (+10)`); }
  else if (priceChg5m >= 10) { score += 7;  reasons.push(`📈 Price +${priceChg5m.toFixed(1)}% in 5min (+7)`); }
  else if (priceChg5m >= 5)  { score += 4;  reasons.push(`📈 Price +${priceChg5m.toFixed(1)}% in 5min (+4)`); }
  else if (priceChg5m < -10) { score -= 10; reasons.push(`📉 Price ${priceChg5m.toFixed(1)}% in 5min (-10)`); }

  if (liquidity >= 100000)     { score += 10; reasons.push(`💧 Liquidità $${Math.round(liquidity/1000)}k (+10)`); }
  else if (liquidity >= 50000) { score += 7;  reasons.push(`💧 Liquidità $${Math.round(liquidity/1000)}k (+7)`); }
  else if (liquidity >= 25000) { score += 5;  reasons.push(`💧 Liquidità $${Math.round(liquidity/1000)}k (+5)`); }
  else if (liquidity >= 10000) { score += 3;  reasons.push(`💧 Liquidità $${Math.round(liquidity/1000)}k (+3)`); }

  if (mcap >= 50000 && mcap <= 500000)       { score += 10; reasons.push(`💰 MCap ottimale $${Math.round(mcap/1000)}k (+10)`); }
  else if (mcap > 500000 && mcap <= 2000000) { score += 5;  reasons.push(`💰 MCap $${Math.round(mcap/1000)}k (+5)`); }
  else if (mcap < 50000 && mcap > 0)         { score += 5;  reasons.push(`💰 MCap micro $${Math.round(mcap/1000)}k (+5)`); }

  if (hasSocials) { score += 5; reasons.push(`🌐 Social presenti (+5)`); }

  if (vol1h >= 200000)      { score += 5; reasons.push(`📊 Volume 1h $${Math.round(vol1h/1000)}k (+5)`); }
  else if (vol1h >= 100000) { score += 3; reasons.push(`📊 Volume 1h $${Math.round(vol1h/1000)}k (+3)`); }

  return { score: Math.max(0, Math.min(score, 110)), reasons };
}

// ─── SEND ALERT ───────────────────────────────────────────────────────────────
async function sendAlert(pair, score, reasons, whaleWallet, buyers) {
  const socials  = pair.info?.socials || [];
  const twitter  = socials.find(s => s.type === 'twitter')?.url  || '';
  const telegram = socials.find(s => s.type === 'telegram')?.url || '';
  const website  = pair.info?.websites?.[0]?.url || '';
  const mint     = pair.baseToken?.address || '';
  const dex      = pair.dexId || 'unknown';

  const payload = {
    name:            pair.baseToken?.name   || 'Unknown',
    symbol:          pair.baseToken?.symbol || '???',
    score,
    dex,
    market_cap_usd:  Math.round(parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 0),
    liquidity_usd:   Math.round(parseFloat(pair.liquidity?.usd) || 0),
    volume_5m_usd:   Math.round(parseFloat(pair.volume?.m5) || 0),
    volume_1h_usd:   Math.round(parseFloat(pair.volume?.h1) || 0),
    price_change_5m: parseFloat(pair.priceChange?.m5)?.toFixed(2) || '0',
    buys_5m:         pair.txns?.m5?.buys  || 0,
    sells_5m:        pair.txns?.m5?.sells || 0,
    age_minutes:     pair.ageMinutes || 0,
    mint,
    whale_detected:  !!whaleWallet,
    whale_wallet:    whaleWallet || null,
    twitter,
    telegram,
    website,
    pair_url:        pair.url || `https://dexscreener.com/solana/${mint}`,
    pump_url:        `https://pump.fun/${mint}`,
    reasons:         reasons.join('\n')
  };

  try {
    await httpPost(N8N_WEBHOOK, payload);
    console.log(`✅ Alert sent: ${payload.name} (${payload.symbol}) — score ${score}`);
  } catch (e) {
    console.error(`❌ Failed to send alert: ${e.message}`);
  }
}

// ─── WHALE LEARNING ───────────────────────────────────────────────────────────
function scheduleWhaleLearn(pairAddress, basePrice, buyers) {
  setTimeout(async () => {
    try {
      const data = await httpGet(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
      const pair = data?.pairs?.[0];
      if (!pair) return;
      const currentPrice = parseFloat(pair.priceUsd) || 0;
      if (basePrice > 0 && currentPrice >= basePrice * WHALE_LEARN_2X) {
        let added = 0;
        for (const wallet of buyers) {
          if (!whaleWallets.has(wallet)) { whaleWallets.add(wallet); added++; }
        }
        if (added > 0) console.log(`🧠 Auto-learned ${added} new whale wallets (token did ${(currentPrice/basePrice).toFixed(1)}x)`);
      }
    } catch (e) { /* silently ignore */ }
  }, WHALE_LEARN_MS);
}

// ─── MAIN SCAN ────────────────────────────────────────────────────────────────
async function scan() {
  console.log(`\n🔍 Scanning DexScreener... [${new Date().toISOString()}]`);
  await loadWhalesFromGMGN();

  try {
    const profilesData = await httpGet('https://api.dexscreener.com/token-profiles/latest/v1');
    const profiles = Array.isArray(profilesData) ? profilesData : [];
    const solanaProfiles = profiles.filter(p => p.chainId === 'solana').slice(0, 30);

    if (solanaProfiles.length === 0) { console.log('No new Solana profiles found.'); return; }

    const addresses = solanaProfiles.map(p => p.tokenAddress).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i + 30));

    const pairs = [];
    for (const chunk of chunks) {
      try {
        const data = await httpGet(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
        if (Array.isArray(data?.pairs)) pairs.push(...data.pairs);
      } catch (e) { /* skip chunk */ }
    }

    const now = Date.now();
    for (const pair of pairs) {
      if (pair.chainId !== 'solana') continue;

      const pairAddress = pair.pairAddress;
      const liquidity   = parseFloat(pair.liquidity?.usd) || 0;
      const pairAge     = pair.pairCreatedAt ? (now - pair.pairCreatedAt) / 60000 : 999;

      pair.ageMinutes = Math.round(pairAge);

      if (pairAge > MAX_TOKEN_AGE_HRS * 60) continue;
      if (liquidity < MIN_LIQUIDITY_USD) continue;
      if (alertedTokens.has(pairAddress)) continue;

      let whaleWallet = null;
      let buyers = [];
      if (whaleWallets.size > 0) {
        buyers = await getBuyersForPair(pairAddress);
        whaleWallet = checkWhaleInBuyers(buyers);
      }

      const { score, reasons } = scoreToken(pair, whaleWallet);
      console.log(`  ${pair.baseToken?.symbol || '?'} | age: ${pair.ageMinutes}min | liq: $${Math.round(liquidity/1000)}k | score: ${score}${whaleWallet ? ' 🐳' : ''}`);

      if (WHALE_ALERT_IMMED && whaleWallet && !alertedTokens.has(pairAddress)) {
        alertedTokens.add(pairAddress);
        console.log(`🐳 WHALE ALERT IMMEDIATO: ${pair.baseToken?.symbol}`);
        await sendAlert(pair, score, reasons, whaleWallet, buyers);
        scheduleWhaleLearn(pairAddress, parseFloat(pair.priceUsd) || 0, buyers);
        continue;
      }

      if (score >= MIN_SCORE) {
        alertedTokens.add(pairAddress);
        await sendAlert(pair, score, reasons, whaleWallet, buyers);
        scheduleWhaleLearn(pairAddress, parseFloat(pair.priceUsd) || 0, buyers);
      }

      if (!seenTokens.has(pairAddress) && buyers.length > 0) {
        seenTokens.set(pairAddress, { priceUsd: parseFloat(pair.priceUsd) || 0, buyers });
      }
    }

    if (alertedTokens.size > 1000) {
      const arr = [...alertedTokens];
      arr.slice(0, 500).forEach(a => alertedTokens.delete(a));
    }
    if (seenTokens.size > 500) {
      const arr = [...seenTokens.keys()];
      arr.slice(0, 200).forEach(k => seenTokens.delete(k));
    }

  } catch (e) {
    console.error(`❌ Scan error: ${e.message}`);
  }
}

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  console.log('🚀 DexScreener Scanner with Whale Tracking started!');
  console.log(`   MIN_SCORE: ${MIN_SCORE} | SCAN_INTERVAL: ${SCAN_INTERVAL_MS/1000}s | MAX_AGE: ${MAX_TOKEN_AGE_HRS}h`);
  console.log(`   WHALE_BONUS: +${WHALE_BONUS} | WHALE_ALERT_IMMEDIATE: ${WHALE_ALERT_IMMED}`);

  lastWhaleFetch = 0;
  await loadWhalesFromGMGN();
  await scan();
  setInterval(scan, SCAN_INTERVAL_MS);
}

start();
