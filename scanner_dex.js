'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const N8N_WEBHOOK        = 'https://nikbumme.app.n8n.cloud/webhook/dex-scanner';
const MIN_SCORE          = 65;
const SCAN_INTERVAL_MS   = 2 * 60 * 1000;
const MAX_TOKEN_AGE_HRS  = 2;
const MIN_LIQUIDITY_USD  = 10_000;
const WHALE_BONUS        = 25;
const WHALE_ALERT_IMMED  = true;
const WHALE_REFRESH_MS   = 6 * 60 * 60 * 1000;
const MAX_TRADES_CHECK   = 50;

// ─── PAPER TRADING CONFIG ─────────────────────────────────────────────────────
const PAPER_STOP_LOSS_PCT  = 0.30;
const PAPER_MAX_HOLD_MS    = 2 * 60 * 60 * 1000;
const CHECK_POSITIONS_MS   = 5 * 60 * 1000;
const MILESTONES           = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0];
const MIN_POSITIONS_LEARN  = 5;

// ─── FILE PATHS ───────────────────────────────────────────────────────────────
const WHALE_FILE     = path.join(__dirname, 'whale_wallets.json');
const POSITIONS_FILE = path.join(__dirname, 'positions_history.json');
const LEARNINGS_FILE = path.join(__dirname, 'learnings.json');

// ─── SEED WHALE WALLETS ───────────────────────────────────────────────────────
const SEED_WHALES = [
  'GBNrXSjBgHSBMJCFrBkFG7JTacFP5L8HHsXkGVzk4faS',
  'CRJoMmFGAWnCyJqNMQsHLX3zJ5KcqPKUNGe8gPnXGXNK',
  'BpN53nsFxFJMCWe8mVGYrAhTmZnYtQHHPkXLJFPJJ2L4',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWgR9bt',
  'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
  '5tzFkiKscfRcs8WkvzLJFPJBFHZv3Exo5s1SBFqx8N8Y',
  'ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BrmMLMQo8YT',
  'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgj'
];

// ─── STATE ────────────────────────────────────────────────────────────────────
const alertedTokens = new Set();
const trackedTokens = new Map();
let   whaleWallets  = new Set(SEED_WHALES);
let   lastWhaleFetch = 0;
let   totalWhalesLearned = 0;

let openPositions   = new Map();
let closedPositions = [];
let learnings       = {};

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
function saveJSON(filePath, data) {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
  catch (e) { console.log(`⚠️  Save failed ${path.basename(filePath)}: ${e.message}`); }
}

function loadJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { console.log(`⚠️  Load failed ${path.basename(filePath)}: ${e.message}`); }
  return defaultValue;
}

function loadAllFromDisk() {
  const savedWhales = loadJSON(WHALE_FILE, []);
  savedWhales.forEach(w => whaleWallets.add(w));
  console.log(`💾 Whale wallets: ${whaleWallets.size} (${savedWhales.length} da disco + seed)`);

  const history = loadJSON(POSITIONS_FILE, { closed: [] });
  closedPositions = history.closed || [];
  console.log(`💾 Storico posizioni: ${closedPositions.length} chiuse`);

  learnings = loadJSON(LEARNINGS_FILE, { recommendation: 'Dati insufficienti — continua a girare.' });
  if (learnings.optimalTP) {
    console.log(`🧠 Strategia appresa: TP +${Math.round(learnings.optimalTP*100)}% | SL -${Math.round(learnings.optimalSL*100)}% | da ${closedPositions.length} posizioni`);
  }
}

function saveWhalesToDisk() { saveJSON(WHALE_FILE, [...whaleWallets]); }
function savePositionsHistory() { saveJSON(POSITIONS_FILE, { closed: closedPositions, lastSaved: new Date().toISOString() }); }
function saveLearnings() { saveJSON(LEARNINGS_FILE, learnings); }

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error: ' + url)); }
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
    const req = https.request({
      hostname: urlObj.hostname, path: urlObj.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
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

// ─── GMGN WHALE REFRESH ───────────────────────────────────────────────────────
async function tryRefreshWhalesFromGMGN() {
  if (Date.now() - lastWhaleFetch < WHALE_REFRESH_MS) return;
  lastWhaleFetch = Date.now();
  try {
    const data = await httpGet('https://gmgn.ai/defi/quotation/v1/rank/sol/wallets/7d?limit=100&orderby=pnl_7d&direction=desc');
    const wallets = data?.data?.rank;
    if (Array.isArray(wallets) && wallets.length > 0) {
      let added = 0;
      wallets.forEach(w => {
        if (w.wallet_address && !whaleWallets.has(w.wallet_address)) {
          whaleWallets.add(w.wallet_address); added++;
        }
      });
      if (added > 0) { saveWhalesToDisk(); console.log(`🐳 GMGN: +${added} whale wallets (tot: ${whaleWallets.size})`); }
    }
  } catch { /* GMGN spesso blocca — non critico */ }
}

// ─── WHALE HELPERS ────────────────────────────────────────────────────────────
async function getBuyersForPair(pairAddress) {
  try {
    const data = await httpGet(`https://api.dexscreener.com/latest/dex/trades/${pairAddress}`);
    const trades = data?.trades || data;
    if (!Array.isArray(trades)) return [];
    return trades.slice(0, MAX_TRADES_CHECK).filter(t => t.type === 'buy' && t.maker).map(t => t.maker);
  } catch { return []; }
}

function checkWhaleInBuyers(buyers) {
  for (const w of buyers) { if (whaleWallets.has(w)) return w; }
  return null;
}

function learnWhalesFromBuyers(buyers, symbol, multiplier) {
  let added = 0;
  for (const w of buyers) {
    if (!whaleWallets.has(w)) { whaleWallets.add(w); added++; totalWhalesLearned++; }
  }
  if (added > 0) {
    saveWhalesToDisk();
    console.log(`🧠 Whale: +${added} wallet da ${symbol} (${multiplier.toFixed(1)}x) — tot: ${whaleWallets.size}`);
  }
}

// ─── PAPER TRADING: OPEN POSITION ────────────────────────────────────────────
function openPosition(pair, score, whaleWallet, buyers) {
  const entryPrice = parseFloat(pair.priceUsd) || 0;
  if (entryPrice === 0) return;

  const pos = {
    pairAddress:    pair.pairAddress,
    mint:           pair.baseToken?.address || '',
    name:           pair.baseToken?.name    || 'Unknown',
    symbol:         pair.baseToken?.symbol  || '???',
    dex:            pair.dexId || 'unknown',
    entryPrice,
    entryMcap:      Math.round(parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 0),
    entryTime:      Date.now(),
    score,
    ageAtEntry:     pair.ageMinutes || 0,
    whaleDetected:  !!whaleWallet,
    whaleWallet:    whaleWallet || null,
    buyers:         buyers || [],
    peakPrice:      entryPrice,
    peakMultiplier: 1.0,
    lastPrice:      entryPrice,
    lowestPrice:    entryPrice,
    milestonesReached: [],
    timesToMilestone:  {},
    closed:         false,
    closeReason:    null,
    closePrice:     null,
    closeMultiplier: null,
    closedAt:       null,
    durationMs:     null
  };

  openPositions.set(pair.pairAddress, pos);
  console.log(`📂 Posizione aperta: ${pos.symbol} @ $${entryPrice.toExponential(3)} | score: ${score}${whaleWallet ? ' 🐳' : ''}`);
}

// ─── PAPER TRADING: CHECK POSITIONS ──────────────────────────────────────────
async function checkOpenPositions() {
  if (openPositions.size === 0) return;
  console.log(`\n📊 Controllo ${openPositions.size} posizioni aperte...`);

  for (const [pairAddress, pos] of openPositions.entries()) {
    try {
      const data = await httpGet(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
      const pair = data?.pairs?.[0];
      if (!pair) continue;

      const currentPrice = parseFloat(pair.priceUsd) || 0;
      if (currentPrice === 0) continue;

      const multiplier = currentPrice / pos.entryPrice;
      const elapsed    = Date.now() - pos.entryTime;

      if (currentPrice > pos.peakPrice) { pos.peakPrice = currentPrice; pos.peakMultiplier = multiplier; }
      if (currentPrice < pos.lowestPrice) pos.lowestPrice = currentPrice;
      pos.lastPrice = currentPrice;

      for (const m of MILESTONES) {
        if (multiplier >= 1 + m && !pos.milestonesReached.includes(m)) {
          pos.milestonesReached.push(m);
          pos.timesToMilestone[m.toString()] = elapsed;
          console.log(`  🎯 ${pos.symbol} +${Math.round(m*100)}% in ${Math.round(elapsed/60000)} min`);
        }
      }

      const gain = (multiplier - 1) * 100;
      console.log(`  ${pos.symbol}: ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}% | peak: ${pos.peakMultiplier.toFixed(2)}x`);

      if (1 - multiplier >= PAPER_STOP_LOSS_PCT) { await closePosition(pairAddress, pos, currentPrice, 'stop_loss'); continue; }
      if (elapsed >= PAPER_MAX_HOLD_MS)           { await closePosition(pairAddress, pos, currentPrice, 'timeout'); continue; }

    } catch { /* skip */ }
  }
}

async function closePosition(pairAddress, pos, closePrice, reason) {
  const closeMultiplier = closePrice / pos.entryPrice;
  const durationMs      = Date.now() - pos.entryTime;

  pos.closed = true; pos.closeReason = reason; pos.closePrice = closePrice;
  pos.closeMultiplier = closeMultiplier; pos.closedAt = new Date().toISOString(); pos.durationMs = durationMs;

  openPositions.delete(pairAddress);
  closedPositions.push({ ...pos, buyers: pos.buyers.length });

  const gain  = (closeMultiplier - 1) * 100;
  const emoji = closeMultiplier >= 1.5 ? '🟢' : closeMultiplier >= 1 ? '🟡' : '🔴';
  console.log(`${emoji} CHIUSA: ${pos.symbol} | ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}% | peak: ${((pos.peakMultiplier-1)*100).toFixed(1)}% | ${reason} | ${Math.round(durationMs/60000)} min`);

  if (pos.peakMultiplier >= 2.0 && pos.buyers.length > 0) learnWhalesFromBuyers(pos.buyers, pos.symbol, pos.peakMultiplier);

  savePositionsHistory();
  updateLearnings();
}

// ─── STRATEGY LEARNING ────────────────────────────────────────────────────────
function updateLearnings() {
  const closed = closedPositions;
  if (closed.length < MIN_POSITIONS_LEARN) {
    learnings = { totalClosed: closed.length, recommendation: `Dati insufficienti — servono ancora ${MIN_POSITIONS_LEARN - closed.length} posizioni.`, lastUpdated: new Date().toISOString() };
    saveLearnings(); return;
  }

  const tpLevels = [0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0];
  let bestTP = 0.5, bestEV = 0;
  const tpAnalysis = {};
  for (const tp of tpLevels) {
    const reached = closed.filter(p => p.peakMultiplier >= 1 + tp).length;
    const rate = reached / closed.length;
    const ev = rate * tp * 100;
    tpAnalysis[`+${Math.round(tp*100)}%`] = { captured: reached, rate: (rate*100).toFixed(1)+'%', expectedValue: ev.toFixed(1)+'%' };
    if (ev > bestEV) { bestEV = ev; bestTP = tp; }
  }

  const slLevels = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40];
  let bestSL = 0.30;
  const slAnalysis = {};
  for (const sl of slLevels) {
    const hitSL     = closed.filter(p => p.lowestPrice && p.lowestPrice <= p.entryPrice * (1 - sl)).length;
    const recovered = closed.filter(p => p.lowestPrice && p.lowestPrice <= p.entryPrice * (1-sl) && p.peakMultiplier >= 1.0).length;
    slAnalysis[`-${Math.round(sl*100)}%`] = { positions_hit: hitSL, recovered, recovery_rate: hitSL > 0 ? (recovered/hitSL*100).toFixed(1)+'%' : 'N/A' };
    if (hitSL >= 3 && recovered/hitSL < 0.30 && bestSL === 0.30) bestSL = sl;
  }

  const scoreRanges = [[65,70],[70,75],[75,80],[80,90],[90,110]];
  const byScore = {};
  for (const [lo, hi] of scoreRanges) {
    const g = closed.filter(p => p.score >= lo && p.score < hi);
    if (!g.length) continue;
    const avgPeak = g.reduce((s,p) => s+p.peakMultiplier, 0) / g.length;
    byScore[`${lo}-${hi}`] = { count: g.length, avgPeak: avgPeak.toFixed(2)+'x', wins2x: g.filter(p => p.peakMultiplier >= 2).length };
  }

  const wG = closed.filter(p => p.whaleDetected);
  const nG = closed.filter(p => !p.whaleDetected);
  const byWhale = {
    whale:   { count: wG.length, avgPeak: wG.length ? (wG.reduce((s,p) => s+p.peakMultiplier,0)/wG.length).toFixed(2)+'x' : 'N/A', wins2x: wG.filter(p => p.peakMultiplier >= 2).length },
    noWhale: { count: nG.length, avgPeak: nG.length ? (nG.reduce((s,p) => s+p.peakMultiplier,0)/nG.length).toFixed(2)+'x' : 'N/A', wins2x: nG.filter(p => p.peakMultiplier >= 2).length }
  };

  const wins     = closed.filter(p => p.closeMultiplier >= 1.0).length;
  const avgPeak  = closed.reduce((s,p) => s+p.peakMultiplier, 0) / closed.length;
  const avgClose = closed.reduce((s,p) => s+p.closeMultiplier, 0) / closed.length;

  learnings = {
    totalClosed: closed.length,
    winRate: (wins/closed.length*100).toFixed(1)+'%',
    avgPeakMultiplier: avgPeak.toFixed(3),
    avgCloseMultiplier: avgClose.toFixed(3),
    optimalTP: bestTP,
    optimalSL: bestSL,
    tpAnalysis, slAnalysis, byScore, byWhale,
    recommendation: [
      `📊 Analisi su ${closed.length} posizioni`,
      `✅ Win rate: ${(wins/closed.length*100).toFixed(0)}%`,
      `📈 Peak medio: ${avgPeak.toFixed(2)}x | Close medio: ${avgClose.toFixed(2)}x`,
      `🎯 Take Profit ottimale: +${Math.round(bestTP*100)}%`,
      `🛑 Stop Loss ottimale: -${Math.round(bestSL*100)}%`,
      `🐳 Whale peak: ${byWhale.whale.avgPeak} vs No-Whale: ${byWhale.noWhale.avgPeak}`
    ].join('\n'),
    lastUpdated: new Date().toISOString()
  };

  saveLearnings();
  console.log(`\n🧠 Strategia: TP +${Math.round(bestTP*100)}% | SL -${Math.round(bestSL*100)}% | WinRate ${(wins/closed.length*100).toFixed(0)}% | Peak medio ${avgPeak.toFixed(2)}x`);
}

// ─── SCORING ──────────────────────────────────────────────────────────────────
function scoreToken(pair, whaleWallet) {
  let score = 0; const reasons = [];
  const ageMin=pair.ageMinutes||0, vol5m=parseFloat(pair.volume?.m5)||0, vol1h=parseFloat(pair.volume?.h1)||0;
  const priceChg5m=parseFloat(pair.priceChange?.m5)||0, liquidity=parseFloat(pair.liquidity?.usd)||0;
  const mcap=parseFloat(pair.marketCap)||parseFloat(pair.fdv)||0;
  const buys5m=pair.txns?.m5?.buys||0, sells5m=pair.txns?.m5?.sells||0;
  const hasSocials=!!(pair.info?.socials?.length>0||pair.info?.websites?.length>0);

  if (whaleWallet) { score+=WHALE_BONUS; reasons.push(`🐳 Whale: ${whaleWallet.substring(0,8)}... (+${WHALE_BONUS})`); }
  if (ageMin>=10&&ageMin<=30)      { score+=15; reasons.push(`⏱️ Età ottimale ${ageMin}min (+15)`); }
  else if (ageMin>30&&ageMin<=60)  { score+=10; reasons.push(`⏱️ Età buona ${ageMin}min (+10)`); }
  else if (ageMin>60&&ageMin<=120) { score+=5;  reasons.push(`⏱️ Età ok ${ageMin}min (+5)`); }
  if (vol5m>=50000)      { score+=20; reasons.push(`📈 Vol5m $${Math.round(vol5m).toLocaleString()} (+20)`); }
  else if (vol5m>=20000) { score+=15; reasons.push(`📈 Vol5m $${Math.round(vol5m).toLocaleString()} (+15)`); }
  else if (vol5m>=10000) { score+=10; reasons.push(`📈 Vol5m $${Math.round(vol5m).toLocaleString()} (+10)`); }
  else if (vol5m>=5000)  { score+=5;  reasons.push(`📈 Vol5m $${Math.round(vol5m).toLocaleString()} (+5)`); }
  const total5m=buys5m+sells5m;
  if (total5m>0) {
    const r=buys5m/total5m;
    if (r>=0.75)      { score+=15; reasons.push(`🟢 Buy ratio ${Math.round(r*100)}% (+15)`); }
    else if (r>=0.60) { score+=10; reasons.push(`🟢 Buy ratio ${Math.round(r*100)}% (+10)`); }
    else if (r>=0.50) { score+=5;  reasons.push(`🟡 Buy ratio ${Math.round(r*100)}% (+5)`); }
    else if (r<0.35)  { score-=15; reasons.push(`🔴 Sell pressure ${Math.round((1-r)*100)}% (-15)`); }
  }
  if (priceChg5m>=20)      { score+=10; reasons.push(`🚀 +${priceChg5m.toFixed(1)}% 5min (+10)`); }
  else if (priceChg5m>=10) { score+=7;  reasons.push(`📈 +${priceChg5m.toFixed(1)}% 5min (+7)`); }
  else if (priceChg5m>=5)  { score+=4;  reasons.push(`📈 +${priceChg5m.toFixed(1)}% 5min (+4)`); }
  else if (priceChg5m<-10) { score-=10; reasons.push(`📉 ${priceChg5m.toFixed(1)}% 5min (-10)`); }
  if (liquidity>=100000)     { score+=10; reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+10)`); }
  else if (liquidity>=50000) { score+=7;  reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+7)`); }
  else if (liquidity>=25000) { score+=5;  reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+5)`); }
  else if (liquidity>=10000) { score+=3;  reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+3)`); }
  if (mcap>=50000&&mcap<=500000)       { score+=10; reasons.push(`💰 MCap $${Math.round(mcap/1000)}k (+10)`); }
  else if (mcap>500000&&mcap<=2000000) { score+=5;  reasons.push(`💰 MCap $${Math.round(mcap/1000)}k (+5)`); }
  else if (mcap<50000&&mcap>0)         { score+=5;  reasons.push(`💰 MCap micro (+5)`); }
  if (hasSocials) { score+=5; reasons.push(`🌐 Social (+5)`); }
  if (vol1h>=200000)      { score+=5; reasons.push(`📊 Vol1h $${Math.round(vol1h/1000)}k (+5)`); }
  else if (vol1h>=100000) { score+=3; reasons.push(`📊 Vol1h $${Math.round(vol1h/1000)}k (+3)`); }
  return { score: Math.max(0, Math.min(score, 110)), reasons };
}

// ─── SEND ALERT ───────────────────────────────────────────────────────────────
async function sendAlert(pair, score, reasons, whaleWallet) {
  const socials=pair.info?.socials||[];
  const mint=pair.baseToken?.address||'';
  let strategyNote = learnings.optimalTP
    ? `\n🎯 TP suggerito: +${Math.round(learnings.optimalTP*100)}% | SL: -${Math.round(learnings.optimalSL*100)}% (da ${learnings.totalClosed} posizioni)`
    : '\n🎯 TP/SL: ancora in apprendimento...';

  const payload = {
    name: pair.baseToken?.name||'Unknown', symbol: pair.baseToken?.symbol||'???', score,
    dex: pair.dexId||'unknown',
    market_cap_usd: Math.round(parseFloat(pair.marketCap)||parseFloat(pair.fdv)||0),
    liquidity_usd: Math.round(parseFloat(pair.liquidity?.usd)||0),
    volume_5m_usd: Math.round(parseFloat(pair.volume?.m5)||0),
    volume_1h_usd: Math.round(parseFloat(pair.volume?.h1)||0),
    price_change_5m: parseFloat(pair.priceChange?.m5)?.toFixed(2)||'0',
    buys_5m: pair.txns?.m5?.buys||0, sells_5m: pair.txns?.m5?.sells||0,
    age_minutes: pair.ageMinutes||0, mint,
    whale_detected: !!whaleWallet, whale_wallet: whaleWallet||null,
    twitter:  socials.find(s=>s.type==='twitter')?.url||'',
    telegram: socials.find(s=>s.type==='telegram')?.url||'',
    website:  pair.info?.websites?.[0]?.url||'',
    pair_url: pair.url||`https://dexscreener.com/solana/${mint}`,
    pump_url: `https://pump.fun/${mint}`,
    reasons: reasons.join('\n') + strategyNote,
    whale_list_size: whaleWallets.size,
    positions_closed: closedPositions.length,
    optimal_tp: learnings.optimalTP ? `+${Math.round(learnings.optimalTP*100)}%` : 'learning...',
    optimal_sl: learnings.optimalSL ? `-${Math.round(learnings.optimalSL*100)}%` : 'learning...'
  };

  try { await httpPost(N8N_WEBHOOK, payload); console.log(`✅ Alert: ${payload.symbol} score ${score}`); }
  catch (e) { console.error(`❌ Alert failed: ${e.message}`); }
}

// ─── MAIN SCAN ────────────────────────────────────────────────────────────────
async function scan() {
  const now = Date.now();
  console.log(`\n🔍 [${new Date().toISOString()}] Whales:${whaleWallets.size} Open:${openPositions.size} Closed:${closedPositions.length}`);
  await tryRefreshWhalesFromGMGN();

  try {
    const profilesData = await httpGet('https://api.dexscreener.com/token-profiles/latest/v1');
    const profiles = Array.isArray(profilesData) ? profilesData : [];
    const solanaProfiles = profiles.filter(p => p.chainId === 'solana').slice(0, 30);
    if (!solanaProfiles.length) { console.log('No new Solana profiles.'); return; }

    const addresses = solanaProfiles.map(p => p.tokenAddress).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i+30));
    const pairs = [];
    for (const chunk of chunks) {
      try { const d = await httpGet(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`); if (Array.isArray(d?.pairs)) pairs.push(...d.pairs); } catch {}
    }

    for (const pair of pairs) {
      if (pair.chainId !== 'solana') continue;
      const pairAddress = pair.pairAddress;
      const liquidity   = parseFloat(pair.liquidity?.usd) || 0;
      const pairAge     = pair.pairCreatedAt ? (now - pair.pairCreatedAt) / 60000 : 999;
      const symbol      = pair.baseToken?.symbol || '?';
      pair.ageMinutes   = Math.round(pairAge);

      if (pairAge > MAX_TOKEN_AGE_HRS * 60) continue;
      if (liquidity < MIN_LIQUIDITY_USD) continue;

      const buyers     = await getBuyersForPair(pairAddress);
      const whaleWallet = buyers.length > 0 ? checkWhaleInBuyers(buyers) : null;

      // Whale learning passivo su tutti i token
      if (!trackedTokens.has(pairAddress) && buyers.length > 0) {
        trackedTokens.set(pairAddress, true);
        const basePrice = parseFloat(pair.priceUsd) || 0;
        if (basePrice > 0) {
          setTimeout(async () => {
            try {
              const d = await httpGet(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
              const p = d?.pairs?.[0];
              if (p && parseFloat(p.priceUsd) >= basePrice * 2.0) learnWhalesFromBuyers(buyers, symbol, parseFloat(p.priceUsd)/basePrice);
            } catch {}
          }, 30 * 60 * 1000);
        }
      }

      if (alertedTokens.has(pairAddress)) continue;
      const { score, reasons } = scoreToken(pair, whaleWallet);
      console.log(`  ${symbol} | ${pair.ageMinutes}min | $${Math.round(liquidity/1000)}k | score:${score}${whaleWallet ? ' 🐳' : ''}`);

      if (WHALE_ALERT_IMMED && whaleWallet) {
        alertedTokens.add(pairAddress);
        console.log(`🐳 WHALE: ${symbol}`);
        await sendAlert(pair, score, reasons, whaleWallet);
        openPosition(pair, score, whaleWallet, buyers);
        continue;
      }
      if (score >= MIN_SCORE) {
        alertedTokens.add(pairAddress);
        await sendAlert(pair, score, reasons, null);
        openPosition(pair, score, null, buyers);
      }
    }

    if (alertedTokens.size > 1000) { const a=[...alertedTokens]; a.slice(0,500).forEach(x=>alertedTokens.delete(x)); }
    if (trackedTokens.size > 2000) { const a=[...trackedTokens.keys()]; a.slice(0,1000).forEach(k=>trackedTokens.delete(k)); }

  } catch (e) { console.error(`❌ Scan error: ${e.message}`); }
}

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  console.log('🚀 DexScreener Self-Learning Scanner started!');
  console.log(`   Score min: ${MIN_SCORE} | SL: -${PAPER_STOP_LOSS_PCT*100}% | Max hold: ${PAPER_MAX_HOLD_MS/3600000}h`);
  console.log(`   Milestones: ${MILESTONES.map(m=>'+'+Math.round(m*100)+'%').join(', ')}`);

  loadAllFromDisk();
  await scan();
  setInterval(scan, SCAN_INTERVAL_MS);
  setInterval(checkOpenPositions, CHECK_POSITIONS_MS);
  setInterval(() => {
    console.log(`\n📊 Status | Whales:${whaleWallets.size} | Open:${openPositions.size} | Closed:${closedPositions.length}${learnings.optimalTP ? ` | TP:+${Math.round(learnings.optimalTP*100)}% SL:-${Math.round(learnings.optimalSL*100)}%` : ' | learning...'}`);
  }, 60 * 60 * 1000);
}

start();
