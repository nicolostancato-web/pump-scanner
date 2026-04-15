'use strict'; // v2.0-github-persist
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const N8N_WEBHOOK        = 'https://nikbumme.app.n8n.cloud/webhook/dex-scanner';
const N8N_TRACKER        = 'https://nikbumme.app.n8n.cloud/webhook/position-update';
const N8N_RESULT         = 'https://nikbumme.app.n8n.cloud/webhook/update-result';
const MIN_SCORE          = 65;
const SCAN_INTERVAL_MS   = 2 * 60 * 1000;      // scan ogni 2 minuti
const MAX_TOKEN_AGE_HRS  = 2;
const MIN_LIQUIDITY_USD  = 10_000;
const WHALE_BONUS        = 25;
const WHALE_ALERT_IMMED  = true;
const WHALE_REFRESH_MS   = 6 * 60 * 60 * 1000;
const MAX_TRADES_CHECK   = 50;

// ─── PAPER TRADING CONFIG ─────────────────────────────────────────────────────
const PAPER_STOP_LOSS_PCT  = 0.30;             // chiudi se scende 30% dall'entrata
const PAPER_MAX_HOLD_MS    = 2 * 60 * 60 * 1000; // chiudi dopo 2 ore massimo
const CHECK_POSITIONS_MS   = 5 * 60 * 1000;   // controlla posizioni ogni 5 min
const MILESTONES           = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0]; // +50%, +100%...
const MIN_POSITIONS_LEARN  = 5;               // posizioni minime per calcolare strategia

// ─── V2: TRAILING STOP SIMULATION (parallelo a V1, non modifica V1) ──────────
// V2 chiude quando il prezzo scende del 50% dal peak — mai prima.
// V1 rimane invariata: SL -30% dall'entrata, max hold 2h.
const V2_TRAILING_STOP_PCT = 0.50;  // trailing stop -50% dal peak

// ─── V3: TRAILING STOP + FILTRO ETÀ TOKEN ≤ 15 MIN ──────────────────────────
// V3 = identica a V2 ma simula di NON aver preso token con età > 15 min
const V3_MAX_AGE_MIN       = 15;   // filtro duro: solo token < 15 min all'entry
const V3_TRAILING_STOP_PCT = 0.50; // stesso trailing di V2

// ─── GITHUB PERSISTENCE ──────────────────────────────────────────────────────
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO   = 'nicolostancato-web/pump-scanner';
const GITHUB_BRANCH = 'main';

// ─── SMART MONEY CONFIG ───────────────────────────────────────────────────────
// Traccia wallet che entrano SEMPRE presto nei token — insider / dev wallets
const SMART_MONEY_MIN_APPEARANCES = 3;   // minimo apparse in token diversi per essere "smart"
const SMART_MONEY_BONUS           = 30;  // punti bonus se smart money wallet rilevato
const SMART_MONEY_ENABLED         = true; // raccolta sempre attiva

// ─── X (TWITTER) ANALYTICS ───────────────────────────────────────────────────
// Impostare X_ENABLED = true quando si vuole attivare l'analisi Twitter
const X_ENABLED      = false;  // << DISABILITATO — attivare quando pronto
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || '';  // variabile Railway

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

// Smart Money tracking
// { walletAddress: { appearances: N, tokens: ['SYM1','SYM2'...], wins: N, totalPeak: X, firstSeen: ISO, lastSeen: ISO } }
let smartMoney = {};

// Paper trading state
let openPositions   = new Map();  // pairAddress → position object
let closedPositions = [];         // array of all closed positions
let learnings       = {};         // strategia appresa

// ─── PERSISTENCE (GitHub) ────────────────────────────────────────────────────
function githubRequest(method, filePath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/contents/${filePath}`,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'dex-scanner',
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({}); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('GitHub timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function githubLoad(filePath, defaultValue) {
  try {
    const res = await githubRequest('GET', filePath);
    if (res.content) {
      const decoded = Buffer.from(res.content, 'base64').toString('utf8');
      return JSON.parse(decoded);
    }
  } catch (e) { console.log(`⚠️  GitHub load failed ${filePath}: ${e.message}`); }
  return defaultValue;
}

const githubSHAs = {};  // cache SHAs for updates

async function githubSave(filePath, data, message) {
  try {
    // Get current SHA if not cached
    if (!githubSHAs[filePath]) {
      const res = await githubRequest('GET', filePath);
      if (res.sha) githubSHAs[filePath] = res.sha;
    }
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const body = { message, content, branch: GITHUB_BRANCH };
    if (githubSHAs[filePath]) body.sha = githubSHAs[filePath];
    const res = await githubRequest('PUT', filePath, body);
    if (res.content?.sha) githubSHAs[filePath] = res.content.sha;
    console.log(`💾 GitHub saved: ${filePath}`);
  } catch (e) { console.log(`⚠️  GitHub save failed ${filePath}: ${e.message}`); }
}

async function saveSmartMoney() {
  await githubSave('data/smart_money.json', smartMoney, 'update: smart money wallets');
}

async function loadAllFromGitHub() {
  console.log('📡 Carico stato da GitHub...');

  // Whale wallets
  const savedWhales = await githubLoad('data/whale_wallets.json', []);
  savedWhales.forEach(w => whaleWallets.add(w));
  console.log(`💾 Whale wallets: ${whaleWallets.size} (${savedWhales.length} da GitHub + seed)`);

  // Positions history
  const history = await githubLoad('data/positions_history.json', { closed: [] });
  closedPositions = history.closed || [];
  console.log(`💾 Storico posizioni: ${closedPositions.length} chiuse`);

  // Learnings
  learnings = await githubLoad('data/learnings.json', { recommendation: 'Dati insufficienti.' });

  // Smart Money
  smartMoney = await githubLoad('data/smart_money.json', {});
  const smartCount = Object.keys(smartMoney).filter(w => smartMoney[w].appearances >= SMART_MONEY_MIN_APPEARANCES).length;
  console.log(`🧠 Smart Money wallets: ${Object.keys(smartMoney).length} tracciati, ${smartCount} confermati`);

  if (learnings.optimalTP) {
    console.log(`🧠 Strategia appresa: TP ${(learnings.optimalTP*100).toFixed(0)}% | SL ${(learnings.optimalSL*100).toFixed(0)}% | da ${closedPositions.length} posizioni`);
  }
}

async function saveWhalesToDisk() {
  await githubSave('data/whale_wallets.json', [...whaleWallets], 'update: whale wallets');
}

async function savePositionsHistory() {
  await githubSave('data/positions_history.json', { closed: closedPositions, lastSaved: new Date().toISOString() }, 'update: positions history');
}

async function saveLearnings() {
  await githubSave('data/learnings.json', learnings, 'update: learnings');
}

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
      if (added > 0) { saveWhalesToDisk().catch(()=>{}); console.log(`🐳 GMGN: +${added} whale wallets (tot: ${whaleWallets.size})`); }
    }
  } catch (e) { /* GMGN spesso blocca — non critico */ }
}

// ─── WHALE HELPERS ────────────────────────────────────────────────────────────
// Solana public RPC — estrae i signer delle ultime N transazioni sul pair
async function getBuyersForPair(pairAddress) {
  try {
    // Step 1: prendi le ultime firme di transazione
    const sigsRes = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getSignaturesForAddress',
        params: [pairAddress, { limit: MAX_TRADES_CHECK }]
      });
      const req = https.request({
        hostname: 'api.mainnet-beta.solana.com',
        path: '/', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error('RPC timeout')); });
      req.write(body); req.end();
    });

    const sigs = (sigsRes?.result || []).filter(s => !s.err).slice(0, 20).map(s => s.signature);
    if (sigs.length === 0) return [];

    // Step 2: per ogni firma, estrai il primo signer (= il buyer/seller)
    // Usiamo getTransaction in batch per efficienza (max 5 alla volta)
    const buyers = new Set();
    const batch = sigs.slice(0, 10); // max 10 tx per non bloccare
    for (const sig of batch) {
      try {
        const txRes = await new Promise((resolve, reject) => {
          const body = JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getTransaction',
            params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
          });
          const req = https.request({
            hostname: 'api.mainnet-beta.solana.com',
            path: '/', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
          }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
          });
          req.on('error', reject);
          req.setTimeout(6000, () => { req.destroy(); reject(new Error('tx timeout')); });
          req.write(body); req.end();
        });
        const accountKeys = txRes?.result?.transaction?.message?.accountKeys || [];
        // Il primo signer è il fee payer / buyer
        const signer = accountKeys.find(a => a.signer === true || a.signer === 'true');
        if (signer?.pubkey) buyers.add(signer.pubkey);
      } catch { /* skip questa tx */ }
    }

    const result = [...buyers];
    if (result.length > 0) console.log(`  👥 buyers: ${result.length} wallet da Solana RPC`);
    return result;
  } catch (e) {
    console.log(`  ⚠️ getBuyersForPair: ${e.message}`);
    return [];
  }
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
    saveWhalesToDisk().catch(()=>{});
    console.log(`🧠 Whale: +${added} wallet da ${symbol} (${multiplier.toFixed(1)}x) — tot: ${whaleWallets.size}`);
  }
}

// ─── SMART MONEY TRACKER ─────────────────────────────────────────────────────
// Registra tutti i buyer di un token con timestamp e performance
function trackSmartMoney(buyers, symbol, pairAddress, entryTime) {
  if (!buyers || buyers.length === 0) return;
  const now = new Date().toISOString();
  let updated = 0;

  for (const wallet of buyers) {
    if (!smartMoney[wallet]) {
      smartMoney[wallet] = {
        appearances: 0,
        tokens: [],
        wins: 0,
        losses: 0,
        totalPeak: 0,
        avgPeak: 0,
        firstSeen: now,
        lastSeen: now,
        confirmed: false
      };
    }
    const sm = smartMoney[wallet];
    // Evita duplicati per lo stesso token
    if (!sm.tokens.find(t => t.symbol === symbol)) {
      sm.appearances++;
      sm.tokens.push({ symbol, pairAddress, entryTime: now });
      sm.lastSeen = now;
      sm.confirmed = sm.appearances >= SMART_MONEY_MIN_APPEARANCES;
      updated++;
    }
  }

  if (updated > 0) {
    const confirmed = Object.values(smartMoney).filter(w => w.confirmed).length;
    console.log(`🕵️ Smart Money: ${Object.keys(smartMoney).length} wallet tracciati | ${confirmed} confermati (>=${SMART_MONEY_MIN_APPEARANCES} token)`);
    saveSmartMoney().catch(() => {});
  }
}

// Aggiorna performance di un wallet dopo chiusura posizione
function updateSmartMoneyPerformance(buyers, peakMultiplier, closeMultiplier) {
  if (!buyers || buyers.length === 0) return;
  for (const wallet of buyers) {
    if (smartMoney[wallet]) {
      const sm = smartMoney[wallet];
      sm.totalPeak += peakMultiplier;
      sm.avgPeak = sm.totalPeak / sm.appearances;
      if (peakMultiplier >= 1.5) sm.wins++;
      else sm.losses++;
    }
  }
}

// Controlla se un wallet è smart money confermato
function checkSmartMoney(buyers) {
  if (!buyers || buyers.length === 0) return null;
  for (const wallet of buyers) {
    const sm = smartMoney[wallet];
    if (sm && sm.confirmed) return wallet;
  }
  return null;
}

// ─── PAPER TRADING: OPEN POSITION ────────────────────────────────────────────
function openPosition(pair, score, whaleWallet, buyers, v4Data) {
  const pairAddress = pair.pairAddress;
  const entryPrice  = parseFloat(pair.priceUsd) || 0;
  if (entryPrice === 0) return;

  const pos = {
    pairAddress,
    mint:          pair.baseToken?.address || '',
    name:          pair.baseToken?.name    || 'Unknown',
    symbol:        pair.baseToken?.symbol  || '???',
    dex:           pair.dexId || 'unknown',
    entryPrice,
    entryMcap:     Math.round(parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 0),
    entryTime:     Date.now(),
    score,
    ageAtEntry:    pair.ageMinutes || 0,
    whaleDetected: !!whaleWallet,
    whaleWallet:   whaleWallet || null,
    buyers:        buyers || [],
    pairUrl:       pair.url || `https://dexscreener.com/solana/${pair.baseToken?.address || ''}`,
    // Tracking
    peakPrice:     entryPrice,
    peakMultiplier: 1.0,
    peakMcap:      Math.round(parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 0),
    peakTime:      Date.now(),
    lastPrice:     entryPrice,
    lowestPrice:   entryPrice,
    milestonesReached: [], // es: [0.5, 1.0]
    timesToMilestone:  {}, // es: { '0.5': 300000 } ms to reach
    closed:        false,
    closeReason:   null,
    closePrice:    null,
    closeMultiplier: null,
    closedAt:      null,
    durationMs:    null,
    // Smart Money
    smartMoneyDetected: false,
    smartMoneyWallet:   null,
    // V2: trailing stop simulato in parallelo a V1
    v2: {
      active:          true,   // false quando V2 ha chiuso
      closePrice:      null,
      closeMultiplier: null,
      closeReason:     null,
      closedAt:        null
    },
    // V3: trailing stop identico a V2, ma SOLO se token età <= 15 min all'entry
    // Se età > 15 min → V3 skipped (simula filtro duro)
    v3: {
      eligible:        (pair.ageMinutes || 0) <= V3_MAX_AGE_MIN,  // questo trade sarebbe stato preso?
      active:          (pair.ageMinutes || 0) <= V3_MAX_AGE_MIN,  // false se non eligible o già chiuso
      closePrice:      null,
      closeMultiplier: null,
      closeReason:     null,
      closedAt:        null
    },
    // V4-minimal parallel tracking (no effect on V1/V2/V3)
    v4: v4Data || { eligible: false, score_v4: null, momentum: null, floatRotation: null, uniqueBuyers: 0, concentration: 1, wouldEnter: false },
    // X (Twitter) data — populated async after open
    xFollowers:    null,
    xAgeDays:      null,
    xTweets24h:    null,
    xLikes24h:     null,
    xRetweets24h:  null,
    xScore:        null,
    xSignal:       null
  };

  openPositions.set(pairAddress, pos);
  console.log(`📂 Posizione aperta: ${pos.symbol} @ $${entryPrice.toExponential(3)} | score: ${score}${whaleWallet ? ' 🐳' : ''}`);

  // Fetch X data in background (non blocca l'apertura)
  const twitterUrl = pair.info?.socials?.find(s => s.type === 'twitter')?.url || '';
  if (twitterUrl && X_BEARER_TOKEN) {
    analyzeTwitter(twitterUrl).then(xData => {
      if (!xData) return;
      pos.xFollowers   = xData.followers;
      pos.xAgeDays     = xData.accountAgeDays;
      pos.xTweets24h   = xData.recentTweets24h;
      pos.xLikes24h    = xData.totalLikes24h;
      pos.xRetweets24h = xData.totalRetweets24h;
      const { bonus } = scoreFromTwitter(xData);
      pos.xScore  = bonus;
      pos.xSignal = bonus >= 10 ? '🟢 Strong' : bonus >= 0 ? '🟡 Weak' : '🔴 Red Flag';
      console.log(`🐦 X @${xData.username}: ${xData.followers} followers | ${xData.accountAgeDays}gg | signal: ${pos.xSignal}`);
      // Aggiorna Positions tab con dati X
      sendPositionUpdate(pos, pos.entryMcap, '🟡 OPEN').catch(() => {});
    }).catch(() => {});
  } else {
    // Notifica apertura senza dati X
    sendPositionUpdate(pos, pos.entryMcap, '🟡 OPEN').catch(() => {});
  }
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

      const multiplier   = currentPrice / pos.entryPrice;
      const elapsed      = Date.now() - pos.entryTime;

      // Aggiorna peak
      const currentMcap = Math.round(parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 0);
      if (currentPrice > pos.peakPrice) {
        pos.peakPrice      = currentPrice;
        pos.peakMultiplier = multiplier;
        pos.peakMcap       = currentMcap;
        pos.peakTime       = Date.now();
      }
      if (currentPrice < pos.lowestPrice) pos.lowestPrice = currentPrice;
      pos.lastPrice = currentPrice;

      // ── V2: trailing stop -50% dal peak (check solo se peak > entrata)
      if (pos.v2.active && pos.peakMultiplier > 1.0) {
        const trailingStopPrice = pos.peakPrice * (1 - V2_TRAILING_STOP_PCT);
        if (currentPrice <= trailingStopPrice) {
          pos.v2.active          = false;
          pos.v2.closePrice      = currentPrice;
          pos.v2.closeMultiplier = currentPrice / pos.entryPrice;
          pos.v2.closeReason     = 'trailing_stop';
          pos.v2.closedAt        = new Date().toISOString();
          const v2g = (pos.v2.closeMultiplier - 1) * 100;
          console.log(`  🔵 V2 trailing stop: ${pos.symbol} → ${v2g >= 0 ? '+' : ''}${v2g.toFixed(1)}% (peak was ${pos.peakMultiplier.toFixed(2)}x)`);
        }
      }

      // ── V3: stessa logica V2, ma solo se token era eligible (<= 15 min)
      if (pos.v3.active && pos.v3.eligible && pos.peakMultiplier > 1.0) {
        const trailingStopPrice = pos.peakPrice * (1 - V3_TRAILING_STOP_PCT);
        if (currentPrice <= trailingStopPrice) {
          pos.v3.active          = false;
          pos.v3.closePrice      = currentPrice;
          pos.v3.closeMultiplier = currentPrice / pos.entryPrice;
          pos.v3.closeReason     = 'trailing_stop';
          pos.v3.closedAt        = new Date().toISOString();
          const v3g = (pos.v3.closeMultiplier - 1) * 100;
          console.log(`  🟣 V3 trailing stop: ${pos.symbol} → ${v3g >= 0 ? '+' : ''}${v3g.toFixed(1)}% (age was ${pos.ageAtEntry}min, eligible)`);
        }
      }

      // Traccia milestones raggiunte
      for (const m of MILESTONES) {
        const key = m.toString();
        if (multiplier >= 1 + m && !pos.milestonesReached.includes(m)) {
          pos.milestonesReached.push(m);
          pos.timesToMilestone[key] = elapsed;
          console.log(`  🎯 ${pos.symbol} ha raggiunto +${Math.round(m*100)}% (${(multiplier).toFixed(2)}x) in ${Math.round(elapsed/60000)} min`);
        }
      }

      const gain = (multiplier - 1) * 100;
      console.log(`  ${pos.symbol}: ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}% (${multiplier.toFixed(2)}x) | peak: ${pos.peakMultiplier.toFixed(2)}x`);

      // Chiudi per stop loss: scende 30% dall'entrata
      const drawdownFromEntry = 1 - multiplier;
      if (drawdownFromEntry >= PAPER_STOP_LOSS_PCT) {
        await closePosition(pairAddress, pos, currentPrice, 'stop_loss');
        continue;
      }

      // Chiudi per timeout (2 ore)
      if (elapsed >= PAPER_MAX_HOLD_MS) {
        await closePosition(pairAddress, pos, currentPrice, 'timeout');
        continue;
      }

    } catch (e) { /* skip questo giro */ }
  }
}

async function sendPositionUpdate(pos, currentMcap, status) {
  try {
    const changePct  = pos.entryMcap > 0 ? (((currentMcap - pos.entryMcap) / pos.entryMcap) * 100).toFixed(1) : '0';
    const peakPct    = pos.entryMcap > 0 ? (((pos.peakMcap  - pos.entryMcap) / pos.entryMcap) * 100).toFixed(1) : '0';
    await httpPost(N8N_TRACKER, {
      'Contract':       pos.mint,
      'Symbol':         pos.symbol,
      'Source':         'DEXSCREENER',
      'Score':          pos.score,
      'Entry Time':     new Date(pos.entryTime).toISOString().replace('T',' ').slice(0,19),
      'Entry MCap $':   pos.entryMcap,
      'Current MCap $': currentMcap,
      'Change %':       changePct + '%',
      'Peak MCap $':    pos.peakMcap || pos.entryMcap,
      'Peak %':         peakPct + '%',
      'Status':         status,
      'Close Reason':   pos.closeReason || '',
      'Duration min':   Math.round((Date.now() - pos.entryTime) / 60000),
      'TP Suggested':   learnings.optimalTP ? `+${Math.round(learnings.optimalTP*100)}%` : 'learning...',
      'SL Suggested':   learnings.optimalSL ? `-${Math.round(learnings.optimalSL*100)}%` : 'learning...',
      'Link':           pos.pairUrl || `https://dexscreener.com/solana/${pos.mint}`,
      'Smart Money':    pos.smartMoneyDetected ? '💎 YES' : 'No',
      'X Followers':    pos.xFollowers !== null ? pos.xFollowers : '',
      'X Age Days':     pos.xAgeDays   !== null ? pos.xAgeDays   : '',
      'X Tweets 24h':   pos.xTweets24h !== null ? pos.xTweets24h : '',
      'X Likes 24h':    pos.xLikes24h  !== null ? pos.xLikes24h  : '',
      'X Score':        pos.xScore     !== null ? pos.xScore     : '',
      'X Signal':       pos.xSignal    || '',
      // V2 trailing stop simulation
      'V2 Result':      pos.v2 && pos.v2.closeMultiplier !== null
                          ? ((pos.v2.closeMultiplier >= 1 ? '🟢 +' : '🔴 -') + Math.abs((pos.v2.closeMultiplier - 1) * 100).toFixed(0) + '%')
                          : (pos.v2 && pos.v2.active ? '🔵 Running' : ''),
      'V2 vs V1':       (pos.v2 && pos.v2.closeMultiplier !== null && pos.closeMultiplier !== null)
                          ? ((pos.v2.closeMultiplier - pos.closeMultiplier) * 100 >= 0 ? '+' : '') + ((pos.v2.closeMultiplier - pos.closeMultiplier) * 100).toFixed(0) + '%'
                          : '',
      // V3: trailing stop + filtro età <= 15 min
      'V3 Result':      !pos.v3 ? '' :
                          !pos.v3.eligible ? '⚪ SKIP' :
                          pos.v3.closeMultiplier !== null
                            ? ((pos.v3.closeMultiplier >= 1 ? '🟢 +' : '🔴 -') + Math.abs((pos.v3.closeMultiplier - 1) * 100).toFixed(0) + '%')
                            : (pos.v3.active ? '🔵 Running' : ''),
      'V3 vs V1':       (!pos.v3 || !pos.v3.eligible || pos.v3.closeMultiplier === null || pos.closeMultiplier === null) ? '' :
                          ((pos.v3.closeMultiplier - pos.closeMultiplier) * 100 >= 0 ? '+' : '') + ((pos.v3.closeMultiplier - pos.closeMultiplier) * 100).toFixed(0) + '%',
      // V4-minimal parallel tracking
      'V4 Eligible':    pos.v4 ? (pos.v4.eligible ? 'YES' : 'NO') : '',
      'V4 Score':       pos.v4 && pos.v4.score_v4 !== null ? pos.v4.score_v4 : '',
      'V4 Momentum':    pos.v4 && pos.v4.momentum !== null ? pos.v4.momentum.toFixed(2) : '',
      'V4 Float Rot':   pos.v4 && pos.v4.floatRotation !== null ? pos.v4.floatRotation.toFixed(3) : '',
      'V4 Buyers':      pos.v4 ? pos.v4.uniqueBuyers : '',
      'V4 Conc %':      pos.v4 && pos.v4.concentration !== null ? Math.round(pos.v4.concentration * 100) : '',
      'V4 WouldEnter':  pos.v4 ? (pos.v4.wouldEnter ? 'YES' : 'NO') : ''
    });
    console.log(`📡 Tracker: ${pos.symbol} → ${status}`);
  } catch (e) { console.log(`⚠️ Tracker failed: ${pos.symbol} ${e.message}`); }
}

async function closePosition(pairAddress, pos, closePrice, reason) {
  const closeMultiplier = closePrice / pos.entryPrice;
  const durationMs      = Date.now() - pos.entryTime;

  pos.closed          = true;
  pos.closeReason     = reason;
  pos.closePrice      = closePrice;
  pos.closeMultiplier = closeMultiplier;
  pos.closedAt        = new Date().toISOString();
  pos.durationMs      = durationMs;

  // ── V2: se ancora aperta, chiudila allo stesso prezzo di V1
  if (pos.v2.active) {
    pos.v2.active          = false;
    pos.v2.closePrice      = closePrice;
    pos.v2.closeMultiplier = closeMultiplier;
    pos.v2.closeReason     = reason;
    pos.v2.closedAt        = new Date().toISOString();
  }

  // ── V3: se eligible e ancora aperta, chiudi allo stesso prezzo di V1
  if (pos.v3.eligible && pos.v3.active) {
    pos.v3.active          = false;
    pos.v3.closePrice      = closePrice;
    pos.v3.closeMultiplier = closeMultiplier;
    pos.v3.closeReason     = reason;
    pos.v3.closedAt        = new Date().toISOString();
  }

  openPositions.delete(pairAddress);
  closedPositions.push({ ...pos, buyers: pos.buyers.length });

  // Aggiorna sheet con stato finale
  const closeMcap   = Math.round(closePrice / pos.entryPrice * pos.entryMcap);
  const closeStatus = closeMultiplier >= 1.5 ? '🟢 CLOSED WIN' : closeMultiplier >= 1.0 ? '🟡 CLOSED FLAT' : '🔴 CLOSED LOSS';
  await sendPositionUpdate(pos, closeMcap, closeStatus);

  const gain   = (closeMultiplier - 1) * 100;
  const emoji  = closeMultiplier >= 1.5 ? '🟢' : closeMultiplier >= 1 ? '🟡' : '🔴';
  const peakG  = (pos.peakMultiplier - 1) * 100;
  console.log(`${emoji} CHIUSA: ${pos.symbol} | ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}% (${closeMultiplier.toFixed(2)}x) | peak: +${peakG.toFixed(1)}% | motivo: ${reason} | durata: ${Math.round(durationMs/60000)} min`);
  // ── V1 vs V2 vs V3 comparison log
  {
    const v2cm  = pos.v2.closeMultiplier;
    const v1g   = (closeMultiplier - 1) * 100;
    const v2g   = (v2cm - 1) * 100;
    const delta = v2g - v1g;
    const v1e   = closeMultiplier >= 1 ? '🟢' : '🔴';
    const v2e   = v2cm >= 1 ? '🟢' : '🔴';
    const de    = delta >= 0 ? '▲' : '▼';
    const v3str = pos.v3.eligible
      ? ` | 🟣 V3 ${((pos.v3.closeMultiplier||closeMultiplier)-1)*100 >= 0?'+':''}${(((pos.v3.closeMultiplier||closeMultiplier)-1)*100).toFixed(1)}%`
      : ' | 🟣 V3 SKIP (age>15m)';
    console.log(`  📊 V1 vs V2 vs V3: ${v1e} V1 ${v1g >= 0?'+':''}${v1g.toFixed(1)}% | ${v2e} V2 ${v2g >= 0?'+':''}${v2g.toFixed(1)}% | ${de} Δ ${delta >= 0?'+':''}${delta.toFixed(1)}%${v3str}`);
  }

  // Smart Money: aggiorna performance
  updateSmartMoneyPerformance(pos.buyers && pos.buyers.length > 0 ? pos.buyers : [], pos.peakMultiplier, closeMultiplier);

  // Whale learning: se ha fatto 2x, impara i buyer
  if (pos.peakMultiplier >= 2.0 && pos.buyers.length > 0) {
    learnWhalesFromBuyers(pos.buyers, pos.symbol, pos.peakMultiplier);
  }

  // Scrivi risultato automatico nel Sheet1
  let resultStr = '';
  if (reason === 'stop_loss')          resultStr = `❌ Rug (-${Math.round(PAPER_STOP_LOSS_PCT*100)}%)`;
  else if (closeMultiplier >= 5.0)     resultStr = `🚀 5x+`;
  else if (closeMultiplier >= 3.0)     resultStr = `🟢 3x`;
  else if (closeMultiplier >= 2.0)     resultStr = `🟢 2x`;
  else if (closeMultiplier >= 1.5)     resultStr = `🟡 +50%`;
  else if (closeMultiplier >= 1.2)     resultStr = `🟡 +20%`;
  else if (closeMultiplier >= 1.0)     resultStr = `⚪ Flat`;
  else                                 resultStr = `🔴 -${Math.round((1-closeMultiplier)*100)}%`;
  const peakStr = ` (peak: ${pos.peakMultiplier >= 2 ? pos.peakMultiplier.toFixed(1)+'x' : '+'+Math.round((pos.peakMultiplier-1)*100)+'%'})`;
  try { await httpPost(N8N_RESULT, { mint: pos.mint, result: resultStr + peakStr }); } catch {}

  savePositionsHistory().catch(()=>{});
  updateLearnings();
}

// ─── STRATEGY LEARNING ────────────────────────────────────────────────────────
function updateLearnings() {
  const closed = closedPositions;
  if (closed.length < MIN_POSITIONS_LEARN) {
    learnings = {
      totalClosed: closed.length,
      recommendation: `Dati insufficienti — servono ancora ${MIN_POSITIONS_LEARN - closed.length} posizioni chiuse.`,
      lastUpdated: new Date().toISOString()
    };
    saveLearnings().catch(()=>{});
    return;
  }

  // ── Milestone rates: quante posizioni raggiungono ogni livello
  const milestoneRates = {};
  for (const m of MILESTONES) {
    const reached = closed.filter(p => p.milestonesReached && p.milestonesReached.includes(m)).length;
    milestoneRates[`+${Math.round(m*100)}%`] = {
      reached,
      total: closed.length,
      rate: (reached / closed.length * 100).toFixed(1) + '%'
    };
  }

  // ── Optimal Take Profit: maximizza expected value
  // EV(TP) = P(reaching TP) * TP%
  let bestTP = 0.5, bestEV = 0;
  const tpLevels = [0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0];
  const tpAnalysis = {};
  for (const tp of tpLevels) {
    const reached = closed.filter(p => p.peakMultiplier >= 1 + tp).length;
    const rate    = reached / closed.length;
    const ev      = rate * tp * 100;
    tpAnalysis[`+${Math.round(tp*100)}%`] = {
      captured: reached,
      rate: (rate * 100).toFixed(1) + '%',
      expectedValue: ev.toFixed(1) + '%'
    };
    if (ev > bestEV) { bestEV = ev; bestTP = tp; }
  }

  // ── Optimal Stop Loss: qual è il livello oltre il quale quasi mai recupera?
  // Analizza: tra le posizioni che hanno toccato -X%, quante poi hanno recuperato?
  const slLevels = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40];
  const slAnalysis = {};
  let bestSL = 0.30;
  for (const sl of slLevels) {
    const hitSL     = closed.filter(p => p.lowestPrice && p.lowestPrice <= p.entryPrice * (1 - sl)).length;
    const recovered = closed.filter(p =>
      p.lowestPrice && p.lowestPrice <= p.entryPrice * (1 - sl) &&
      p.peakMultiplier >= 1.0
    ).length;
    const recoveryRate = hitSL > 0 ? (recovered / hitSL * 100).toFixed(1) : 'N/A';
    slAnalysis[`-${Math.round(sl*100)}%`] = {
      positions_hit: hitSL,
      recovered,
      recovery_rate: recoveryRate + '%'
    };
    // SL ottimale: primo livello dove recovery rate scende sotto 30%
    if (hitSL >= 3 && recovered / hitSL < 0.30 && bestSL === 0.30) bestSL = sl;
  }

  // ── By Score range
  const byScore = {};
  const scoreRanges = [[65,70],[70,75],[75,80],[80,90],[90,110]];
  for (const [lo, hi] of scoreRanges) {
    const group = closed.filter(p => p.score >= lo && p.score < hi);
    if (group.length === 0) continue;
    const avgPeak = group.reduce((s, p) => s + p.peakMultiplier, 0) / group.length;
    const wins2x  = group.filter(p => p.peakMultiplier >= 2.0).length;
    byScore[`${lo}-${hi}`] = {
      count: group.length,
      avgPeak: avgPeak.toFixed(2) + 'x',
      wins2x,
      win2xRate: (wins2x / group.length * 100).toFixed(0) + '%'
    };
  }

  // ── By Whale
  const whaleGroup    = closed.filter(p => p.whaleDetected);
  const noWhaleGroup  = closed.filter(p => !p.whaleDetected);
  const byWhale = {
    whale: {
      count:   whaleGroup.length,
      avgPeak: whaleGroup.length ? (whaleGroup.reduce((s,p) => s + p.peakMultiplier, 0) / whaleGroup.length).toFixed(2) + 'x' : 'N/A',
      wins2x:  whaleGroup.filter(p => p.peakMultiplier >= 2).length
    },
    noWhale: {
      count:   noWhaleGroup.length,
      avgPeak: noWhaleGroup.length ? (noWhaleGroup.reduce((s,p) => s + p.peakMultiplier, 0) / noWhaleGroup.length).toFixed(2) + 'x' : 'N/A',
      wins2x:  noWhaleGroup.filter(p => p.peakMultiplier >= 2).length
    }
  };

  // ── By Age at entry
  const byAge = {};
  const ageRanges = [[0,15],[15,30],[30,60],[60,120]];
  for (const [lo, hi] of ageRanges) {
    const group = closed.filter(p => p.ageAtEntry >= lo && p.ageAtEntry < hi);
    if (group.length === 0) continue;
    const avgPeak = group.reduce((s, p) => s + p.peakMultiplier, 0) / group.length;
    byAge[`${lo}-${hi}min`] = {
      count: group.length,
      avgPeak: avgPeak.toFixed(2) + 'x'
    };
  }

  // ── Win/loss stats
  const wins    = closed.filter(p => p.closeMultiplier >= 1.0).length;
  const avgPeak = closed.reduce((s, p) => s + p.peakMultiplier, 0) / closed.length;
  const avgClose = closed.reduce((s, p) => s + p.closeMultiplier, 0) / closed.length;

  // ── Final recommendation
  const rec = [
    `📊 Analisi su ${closed.length} posizioni chiuse`,
    `✅ Win rate (chiuse in positivo): ${(wins/closed.length*100).toFixed(0)}%`,
    `📈 Peak medio: ${avgPeak.toFixed(2)}x | Close medio: ${avgClose.toFixed(2)}x`,
    `🎯 Take Profit ottimale: +${Math.round(bestTP*100)}% (expected value: ${bestEV.toFixed(1)}%)`,
    `🛑 Stop Loss ottimale: -${Math.round(bestSL*100)}%`,
    `🐳 Whale vs No-Whale peak: ${byWhale.whale.avgPeak} vs ${byWhale.noWhale.avgPeak}`
  ].join('\n');

  learnings = {
    totalClosed: closed.length,
    winRate: (wins/closed.length*100).toFixed(1) + '%',
    avgPeakMultiplier: avgPeak.toFixed(3),
    avgCloseMultiplier: avgClose.toFixed(3),
    optimalTP: bestTP,
    optimalSL: bestSL,
    tpAnalysis,
    slAnalysis,
    milestoneRates,
    byScore,
    byWhale,
    byAge,
    recommendation: rec,
    lastUpdated: new Date().toISOString()
  };

  saveLearnings().catch(()=>{});

  console.log('\n' + '═'.repeat(60));
  console.log('🧠 STRATEGIA AGGIORNATA:');
  console.log(`   Take Profit ottimale: +${Math.round(bestTP*100)}%`);
  console.log(`   Stop Loss ottimale:   -${Math.round(bestSL*100)}%`);
  console.log(`   Win rate:             ${(wins/closed.length*100).toFixed(0)}%`);
  console.log(`   Peak medio:           ${avgPeak.toFixed(2)}x`);
  console.log('═'.repeat(60) + '\n');
}

// ─── X (TWITTER) ANALYTICS ──────────────────────────────────────────────────
// Analizza il profilo Twitter di un token prima di mandare l'alert.
// DISABILITATO — attivare impostando X_ENABLED = true e aggiungendo X_BEARER_TOKEN su Railway.
async function analyzeTwitter(twitterUrl) {
  // Raccolta dati sempre attiva; X_ENABLED controlla solo l'influenza sullo score
  if (!X_BEARER_TOKEN || !twitterUrl) return null;

  try {
    // Estrai username dall'URL
    const username = twitterUrl.replace(/.*twitter\.com\//,'').replace(/.*x\.com\//,'').replace(/\?.*/,'').replace(/\/.*/,'').trim();
    if (!username) return null;

    // 1. Cerca dati utente
    const userRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.twitter.com',
        path: `/2/users/by/username/${username}?user.fields=created_at,public_metrics,description`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${X_BEARER_TOKEN}`,
          'User-Agent': 'dex-scanner'
        }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error('X timeout')); });
      req.end();
    });

    const user = userRes?.data;
    if (!user) return null;

    const followers    = user.public_metrics?.followers_count || 0;
    const tweetCount   = user.public_metrics?.tweet_count || 0;
    const createdAt    = user.created_at ? new Date(user.created_at) : null;
    const accountAgeDays = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : 0;

    // 2. Cerca tweet recenti sul token (ultime 24h)
    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const searchRes = await new Promise((resolve, reject) => {
      const query = encodeURIComponent(`@${username} OR $${username} -is:retweet`);
      const req = https.request({
        hostname: 'api.twitter.com',
        path: `/2/tweets/search/recent?query=${query}&max_results=10&start_time=${since}&tweet.fields=public_metrics`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${X_BEARER_TOKEN}`,
          'User-Agent': 'dex-scanner'
        }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error('X search timeout')); });
      req.end();
    });

    const recentTweets  = searchRes?.data?.length || 0;
    const totalLikes    = (searchRes?.data || []).reduce((s, t) => s + (t.public_metrics?.like_count || 0), 0);
    const totalRetweets = (searchRes?.data || []).reduce((s, t) => s + (t.public_metrics?.retweet_count || 0), 0);

    return {
      username,
      followers,
      tweetCount,
      accountAgeDays,
      recentTweets24h: recentTweets,
      totalLikes24h:   totalLikes,
      totalRetweets24h: totalRetweets
    };
  } catch (e) {
    console.log(`⚠️ X analytics failed: ${e.message}`);
    return null;
  }
}

// Calcola bonus/penalità score da dati Twitter
function scoreFromTwitter(xData) {
  if (!xData) return { bonus: 0, reasons: [] };
  const reasons = [];
  let bonus = 0;

  // Follower
  if (xData.followers >= 5000)      { bonus += 15; reasons.push(`🐦 X: ${xData.followers.toLocaleString()} followers (+15)`); }
  else if (xData.followers >= 1000) { bonus += 10; reasons.push(`🐦 X: ${xData.followers.toLocaleString()} followers (+10)`); }
  else if (xData.followers >= 200)  { bonus += 5;  reasons.push(`🐦 X: ${xData.followers.toLocaleString()} followers (+5)`); }
  else if (xData.followers < 50)    { bonus -= 10; reasons.push(`🐦 X: solo ${xData.followers} followers (-10)`); }

  // Età account
  if (xData.accountAgeDays >= 180)    { bonus += 10; reasons.push(`📅 X account ${xData.accountAgeDays}gg (+10)`); }
  else if (xData.accountAgeDays >= 30) { bonus += 5;  reasons.push(`📅 X account ${xData.accountAgeDays}gg (+5)`); }
  else if (xData.accountAgeDays < 7)  { bonus -= 15; reasons.push(`📅 X account nuovo ${xData.accountAgeDays}gg (-15)`); }

  // Attività recente (24h)
  if (xData.recentTweets24h >= 10)    { bonus += 10; reasons.push(`🔥 X: ${xData.recentTweets24h} tweet 24h (+10)`); }
  else if (xData.recentTweets24h >= 3) { bonus += 5;  reasons.push(`📢 X: ${xData.recentTweets24h} tweet 24h (+5)`); }

  // Engagement
  if (xData.totalLikes24h >= 100)    { bonus += 5; reasons.push(`❤️ X: ${xData.totalLikes24h} like 24h (+5)`); }
  if (xData.totalRetweets24h >= 20)  { bonus += 5; reasons.push(`🔁 X: ${xData.totalRetweets24h} RT 24h (+5)`); }

  return { bonus, reasons };
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
    reasons.push(`🐳 Whale wallet: ${whaleWallet.substring(0,8)}... (+${WHALE_BONUS})`);
  }

  // Smart Money bonus — calcolato dai buyers passati come argomento extra
  // (applicato in sendAlert dopo getBuyersForPair)

  if (ageMin >= 10 && ageMin <= 30)      { score += 15; reasons.push(`⏱️ Età ottimale (${ageMin} min) (+15)`); }
  else if (ageMin > 30 && ageMin <= 60)  { score += 10; reasons.push(`⏱️ Età buona (${ageMin} min) (+10)`); }
  else if (ageMin > 60 && ageMin <= 120) { score += 5;  reasons.push(`⏱️ Età accettabile (${ageMin} min) (+5)`); }

  if (vol5m >= 50000)      { score += 20; reasons.push(`📈 Vol 5min $${Math.round(vol5m).toLocaleString()} (+20)`); }
  else if (vol5m >= 20000) { score += 15; reasons.push(`📈 Vol 5min $${Math.round(vol5m).toLocaleString()} (+15)`); }
  else if (vol5m >= 10000) { score += 10; reasons.push(`📈 Vol 5min $${Math.round(vol5m).toLocaleString()} (+10)`); }
  else if (vol5m >= 5000)  { score += 5;  reasons.push(`📈 Vol 5min $${Math.round(vol5m).toLocaleString()} (+5)`); }

  const total5m = buys5m + sells5m;
  if (total5m > 0) {
    const ratio = buys5m / total5m;
    if (ratio >= 0.75)      { score += 15; reasons.push(`🟢 Buy ratio ${Math.round(ratio*100)}% (+15)`); }
    else if (ratio >= 0.60) { score += 10; reasons.push(`🟢 Buy ratio ${Math.round(ratio*100)}% (+10)`); }
    else if (ratio >= 0.50) { score += 5;  reasons.push(`🟡 Buy ratio ${Math.round(ratio*100)}% (+5)`); }
    else if (ratio < 0.35)  { score -= 15; reasons.push(`🔴 Sell pressure ${Math.round((1-ratio)*100)}% (-15)`); }
  }

  if (priceChg5m >= 20)      { score += 10; reasons.push(`🚀 Price +${priceChg5m.toFixed(1)}% 5min (+10)`); }
  else if (priceChg5m >= 10) { score += 7;  reasons.push(`📈 Price +${priceChg5m.toFixed(1)}% 5min (+7)`); }
  else if (priceChg5m >= 5)  { score += 4;  reasons.push(`📈 Price +${priceChg5m.toFixed(1)}% 5min (+4)`); }
  else if (priceChg5m < -10) { score -= 10; reasons.push(`📉 Price ${priceChg5m.toFixed(1)}% 5min (-10)`); }

  if (liquidity >= 100000)     { score += 10; reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+10)`); }
  else if (liquidity >= 50000) { score += 7;  reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+7)`); }
  else if (liquidity >= 25000) { score += 5;  reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+5)`); }
  else if (liquidity >= 10000) { score += 3;  reasons.push(`💧 Liq $${Math.round(liquidity/1000)}k (+3)`); }

  if (mcap >= 50000 && mcap <= 500000)       { score += 10; reasons.push(`💰 MCap $${Math.round(mcap/1000)}k (+10)`); }
  else if (mcap > 500000 && mcap <= 2000000) { score += 5;  reasons.push(`💰 MCap $${Math.round(mcap/1000)}k (+5)`); }
  else if (mcap < 50000 && mcap > 0)         { score += 5;  reasons.push(`💰 MCap micro $${Math.round(mcap/1000)}k (+5)`); }

  if (hasSocials) { score += 5; reasons.push(`🌐 Social presenti (+5)`); }

  if (vol1h >= 200000)      { score += 5; reasons.push(`📊 Vol 1h $${Math.round(vol1h/1000)}k (+5)`); }
  else if (vol1h >= 100000) { score += 3; reasons.push(`📊 Vol 1h $${Math.round(vol1h/1000)}k (+3)`); }

  return { score: Math.max(0, Math.min(score, 110)), reasons };
}

// ─── V4-MINIMAL SCORING ───────────────────────────────────────────────────────
// Parallel tracking only — does NOT affect V1/V2/V3 logic
// Signals: Early Momentum + Float Rotation + Buyer Structure
function computeV4(pair, buyers) {
  const ageMin      = pair.ageMinutes || 0;
  const priceChg5m  = parseFloat(pair.priceChange?.m5) || 0;
  const vol5m       = parseFloat(pair.volume?.m5) || 0;
  const mcap        = parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 1;
  const liquidity   = parseFloat(pair.liquidity?.usd) || 0;

  // ── Raw signals
  const momentum      = priceChg5m / Math.max(ageMin, 1);
  const floatRotation = vol5m / Math.max(mcap, 1);

  // Buyer structure from Solana RPC wallet list
  const walletCounts = {};
  for (const w of (buyers || [])) walletCounts[w] = (walletCounts[w] || 0) + 1;
  const uniqueBuyers  = Object.keys(walletCounts).length;
  const totalTx       = (buyers || []).length;
  const topWalletTx   = totalTx > 0 ? Math.max(...Object.values(walletCounts)) : 0;
  const concentration = totalTx > 0 ? topWalletTx / totalTx : 1;

  // ── Hard filters (eligible = passed all binary gates)
  const smartMoneyPresent = checkSmartMoney(buyers) !== null;
  const eligible = (
    ageMin <= 25 &&
    liquidity >= MIN_LIQUIDITY_USD &&
    uniqueBuyers >= 3 &&
    (concentration <= 0.70 || smartMoneyPresent)
  );

  // ── Score calculation (range: -60 → +85)
  let score = 0;

  // Signal 1: Early Momentum (-20 → +30)
  if      (momentum >= 3.0) score += 30;
  else if (momentum >= 1.5) score += 20;
  else if (momentum >= 0.5) score += 10;
  else if (momentum >= 0.1) score += 3;
  else                      score -= 20;  // token fermo

  // Signal 2: Float Rotation (-10 → +25)
  if      (floatRotation >= 1.5) score += 25;
  else if (floatRotation >= 0.8) score += 18;
  else if (floatRotation >= 0.3) score += 10;
  else if (floatRotation >= 0.1) score += 4;
  else                           score -= 10;  // volume irrilevante

  // Signal 3: Buyer Structure (-30 → +30)
  // Unique buyers count
  if      (uniqueBuyers >= 15) score += 20;
  else if (uniqueBuyers >= 10) score += 13;
  else if (uniqueBuyers >= 6)  score += 7;
  else if (uniqueBuyers >= 3)  score += 2;
  else                         score -= 15;
  // Wallet concentration
  if      (concentration < 0.20) score += 10;
  else if (concentration < 0.40) score += 5;
  else if (concentration < 0.60) score += 0;
  else                           score -= 15;

  const wouldEnter = eligible && score >= 35;

  return { eligible, score_v4: score, momentum, floatRotation, uniqueBuyers, concentration, wouldEnter };
}



// ─── SEND ALERT ───────────────────────────────────────────────────────────────
async function sendAlert(pair, score, reasons, whaleWallet) {
  const socials  = pair.info?.socials || [];
  const twitter  = socials.find(s => s.type === 'twitter')?.url  || '';
  const telegram = socials.find(s => s.type === 'telegram')?.url || '';
  const website  = pair.info?.websites?.[0]?.url || '';
  const mint     = pair.baseToken?.address || '';

  // X Analytics (solo se abilitato)
  if (X_ENABLED && twitter) {
    const xData = await analyzeTwitter(twitter);
    if (xData) {
      const { bonus, reasons: xReasons } = scoreFromTwitter(xData);
      score += bonus;
      reasons.push(...xReasons);
      console.log(`🐦 X: @${xData.username} | ${xData.followers} followers | ${xData.accountAgeDays}gg | ${xData.recentTweets24h} tweet/24h | bonus: ${bonus > 0 ? '+' : ''}${bonus}`);
    }
  }

  // Aggiungi info strategia all'alert
  let strategyNote = '';
  if (learnings.optimalTP) {
    strategyNote = `\n🎯 Strategia appresa: TP +${Math.round(learnings.optimalTP*100)}% | SL -${Math.round(learnings.optimalSL*100)}% (da ${learnings.totalClosed} posizioni)`;
  }

  const payload = {
    name:            pair.baseToken?.name   || 'Unknown',
    symbol:          pair.baseToken?.symbol || '???',
    score,
    dex:             pair.dexId || 'unknown',
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
    reasons:         reasons.join('\n') + strategyNote,
    whale_list_size: whaleWallets.size,
    total_learned:   totalWhalesLearned,
    positions_closed: closedPositions.length,
    optimal_tp:      learnings.optimalTP ? `+${Math.round(learnings.optimalTP*100)}%` : 'learning...',
    optimal_sl:      learnings.optimalSL ? `-${Math.round(learnings.optimalSL*100)}%` : 'learning...'
  };

  try {
    await httpPost(N8N_WEBHOOK, payload);
    console.log(`✅ Alert: ${payload.name} (${payload.symbol}) score ${score}`);
  } catch (e) {
    console.error(`❌ Alert failed: ${e.message}`);
  }
}

// ─── MAIN SCAN ────────────────────────────────────────────────────────────────
async function scan() {
  const now = Date.now();
  console.log(`\n🔍 Scan [${new Date().toISOString()}] | Whales: ${whaleWallets.size} | Open: ${openPositions.size} | Closed: ${closedPositions.length}`);

  await tryRefreshWhalesFromGMGN();

  try {
    const profilesData = await httpGet('https://api.dexscreener.com/token-profiles/latest/v1');
    const profiles = Array.isArray(profilesData) ? profilesData : [];
    const solanaProfiles = profiles.filter(p => p.chainId === 'solana').slice(0, 30);
    if (solanaProfiles.length === 0) { console.log('No new Solana profiles.'); return; }

    const addresses = solanaProfiles.map(p => p.tokenAddress).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i + 30));

    const pairs = [];
    for (const chunk of chunks) {
      try {
        const data = await httpGet(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
        if (Array.isArray(data?.pairs)) pairs.push(...data.pairs);
      } catch { /* skip */ }
    }

    for (const pair of pairs) {
      if (pair.chainId !== 'solana') continue;
      const pairAddress = pair.pairAddress;
      const liquidity   = parseFloat(pair.liquidity?.usd) || 0;
      const pairAge     = pair.pairCreatedAt ? (now - pair.pairCreatedAt) / 60000 : 999;
      const symbol      = pair.baseToken?.symbol || '?';

      pair.ageMinutes = Math.round(pairAge);

      if (pairAge > MAX_TOKEN_AGE_HRS * 60) continue;
      if (liquidity < MIN_LIQUIDITY_USD) continue;

      // Fetch buyers per whale check + learning
      const buyers     = await getBuyersForPair(pairAddress);
      const whaleWallet = buyers.length > 0 ? checkWhaleInBuyers(buyers) : null;

      // Track buyers as potential smart money (tutti i token, non solo alert)
      if (buyers.length > 0) {
        trackSmartMoney(buyers, symbol, pairAddress, Date.now());
      }

      // Traccia tutti i token per whale learning (anche senza alert)
      if (!trackedTokens.has(pairAddress) && buyers.length > 0) {
        trackedTokens.set(pairAddress, true);
        // Schedula controllo 2x dopo 30 min per whale learning passivo
        const basePrice = parseFloat(pair.priceUsd) || 0;
        if (basePrice > 0) {
          setTimeout(async () => {
            try {
              const d = await httpGet(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
              const p = d?.pairs?.[0];
              if (!p) return;
              const currentPrice = parseFloat(p.priceUsd) || 0;
              if (currentPrice >= basePrice * 2.0) learnWhalesFromBuyers(buyers, symbol, currentPrice / basePrice);
            } catch { /* ignore */ }
          }, 30 * 60 * 1000);
        }
      }

      if (alertedTokens.has(pairAddress)) continue;

      const { score, reasons } = scoreToken(pair, whaleWallet);
      console.log(`  ${symbol} | age:${pair.ageMinutes}min | liq:$${Math.round(liquidity/1000)}k | score:${score}${whaleWallet ? ' 🐳' : ''}`);

      // Alert immediato se whale
      if (WHALE_ALERT_IMMED && whaleWallet) {
        alertedTokens.add(pairAddress);
        console.log(`🐳 WHALE ALERT: ${symbol}`);
        await sendAlert(pair, score, reasons, whaleWallet);
        const v4DataWhale = computeV4(pair, buyers);
        console.log(`  [V4] elig=${v4DataWhale.eligible} score=${v4DataWhale.score_v4} mom=${v4DataWhale.momentum.toFixed(2)} rot=${v4DataWhale.floatRotation.toFixed(3)} buyers=${v4DataWhale.uniqueBuyers} conc=${Math.round(v4DataWhale.concentration*100)}% would=${v4DataWhale.wouldEnter}`);
        openPosition(pair, score, whaleWallet, buyers, v4DataWhale);
        continue;
      }

      // Alert normale
      if (score >= MIN_SCORE) {
        alertedTokens.add(pairAddress);
        await sendAlert(pair, score, reasons, null);
        const v4Data = computeV4(pair, buyers);
        console.log(`  [V4] elig=${v4Data.eligible} score=${v4Data.score_v4} mom=${v4Data.momentum.toFixed(2)} rot=${v4Data.floatRotation.toFixed(3)} buyers=${v4Data.uniqueBuyers} conc=${Math.round(v4Data.concentration*100)}% would=${v4Data.wouldEnter}`);
        openPosition(pair, score, null, buyers, v4Data);
      }
    }

    // Pulizia memoria
    if (alertedTokens.size > 1000) { const arr = [...alertedTokens]; arr.slice(0, 500).forEach(a => alertedTokens.delete(a)); }
    if (trackedTokens.size > 2000) { const arr = [...trackedTokens.keys()]; arr.slice(0, 1000).forEach(k => trackedTokens.delete(k)); }

  } catch (e) {
    console.error(`❌ Scan error: ${e.message}`);
  }
}

// ─── HOURLY STRATEGY SUMMARY ──────────────────────────────────────────────────
function printStrategySummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RIEPILOGO ORARIO');
  console.log(`   Whale wallets in memoria: ${whaleWallets.size} (${totalWhalesLearned} appresi in sessione)`);
  console.log(`   Posizioni aperte: ${openPositions.size}`);
  console.log(`   Posizioni chiuse totali: ${closedPositions.length}`);
  if (learnings.optimalTP) {
    console.log(`   🎯 TP ottimale: +${Math.round(learnings.optimalTP*100)}%`);
    console.log(`   🛑 SL ottimale: -${Math.round(learnings.optimalSL*100)}%`);
    console.log(`   ✅ Win rate: ${learnings.winRate}`);
    console.log(`   📈 Peak medio: ${learnings.avgPeakMultiplier}x`);
  } else {
    console.log(`   🧠 ${learnings.recommendation}`);
  }
  console.log('═'.repeat(60) + '\n');
}

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  console.log('🚀 DexScreener Self-Learning Scanner started!');
  console.log(`   Score min: ${MIN_SCORE} | Scan: ogni ${SCAN_INTERVAL_MS/1000}s`);
  console.log(`   Paper trading: SL -${PAPER_STOP_LOSS_PCT*100}% | Max hold: ${PAPER_MAX_HOLD_MS/3600000}h`);
  console.log(`   Learning: milestone tracking @ ${MILESTONES.map(m => '+'+Math.round(m*100)+'%').join(', ')}`);

  await loadAllFromGitHub();

  // Prima scan
  await scan();

  // Scan ogni 2 minuti
  setInterval(scan, SCAN_INTERVAL_MS);

  // Check posizioni aperte ogni 5 minuti
  setInterval(checkOpenPositions, CHECK_POSITIONS_MS);

  // Riepilogo orario
  setInterval(printStrategySummary, 60 * 60 * 1000);
}

start();



