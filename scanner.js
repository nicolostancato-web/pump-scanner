const WebSocket = require('ws');
const https = require('https');

// ─── CONFIG ───────────────────────────────────────────────
const N8N_WEBHOOK          = 'https://nikbumme.app.n8n.cloud/webhook/pump-scanner';
const MIN_INITIAL_BUY_SOL  = 0.5;
const ANALYSIS_DELAY_MS    = 10 * 60 * 1000;
const WHALE_CHECK_DELAY_MS = 30 * 60 * 1000;
const MIN_SCORE            = 78;
const WHALE_BONUS          = 25;
const WHALE_ALERT_IMMEDIATE= true;
const MAX_TOKENS           = 300;

// ─── STATE ────────────────────────────────────────────────
const pendingTokens  = new Map();
const tokenTrades    = new Map();
const whaleWallets   = new Set();
const alreadyAlerted = new Set();

// ─── UTILS ────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pump-scanner/2.0)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function sendToN8N(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const url  = new URL(N8N_WEBHOOK);
    const opts = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(opts, (res) => {
      console.log(`✅ Sent to n8n — HTTP ${res.statusCode}`);
      resolve();
    });
    req.on('error', (e) => { console.error('❌ n8n error:', e.message); resolve(); });
    req.write(data);
    req.end();
  });
}

// ─── FETCH WHALE WALLETS FROM GMGN ────────────────────────
async function refreshWhaleWallets() {
  try {
    const data = await httpsGet('https://gmgn.ai/defi/quotation/v1/rank/sol/wallets/7d?orderby=pnl_7d&direction=desc&limit=50');
    if (data && data.data && data.data.rank) {
      let added = 0;
      for (const wallet of data.data.rank) {
        if (wallet.wallet && !whaleWallets.has(wallet.wallet)) {
          whaleWallets.add(wallet.wallet);
          added++;
        }
      }
      console.log(`🐳 GMGN: loaded ${added} new whale wallets. Total: ${whaleWallets.size}`);
    } else {
      console.log(`⚠️ GMGN: no data returned`);
    }
  } catch (e) {
    console.log(`⚠️ GMGN fetch failed: ${e.message}`);
  }
}

// ─── SCORING ──────────────────────────────────────────────
function scoreToken(creation, current, trades, detectedWhales) {
  let score = 0;
  const reasons = [];

  if (detectedWhales.length > 0) {
    score += WHALE_BONUS;
    reasons.push(`🐳 ${detectedWhales.length} known whale(s) buying! (+${WHALE_BONUS})`);
  }

  const initSol = creation.solAmount || 0;
  if (initSol >= 5)        { score += 15; reasons.push(`Big initial buy: ${initSol} SOL (+15)`); }
  else if (initSol >= 2)   { score += 12; reasons.push(`Good initial buy: ${initSol} SOL (+12)`); }
  else if (initSol >= 1)   { score += 8;  reasons.push(`Initial buy: ${initSol} SOL (+8)`); }
  else if (initSol >= 0.5) { score += 4;  reasons.push(`Small initial buy: ${initSol} SOL (+4)`); }

  const vol = trades ? trades.volumeSol : 0;
  if (vol >= 200)      { score += 20; reasons.push(`Massive volume: ${vol.toFixed(1)} SOL (+20)`); }
  else if (vol >= 80)  { score += 15; reasons.push(`High volume: ${vol.toFixed(1)} SOL (+15)`); }
  else if (vol >= 30)  { score += 10; reasons.push(`Good volume: ${vol.toFixed(1)} SOL (+10)`); }
  else if (vol >= 10)  { score += 5;  reasons.push(`Decent volume: ${vol.toFixed(1)} SOL (+5)`); }
  else                 {              reasons.push(`Low volume: ${vol.toFixed(1)} SOL (+0)`); }

  const buys  = trades ? trades.buys : 0;
  const sells = trades ? trades.sells : 0;
  const total = buys + sells;
  const buyRatio = total > 0 ? buys / total : 0;
  const buyPct   = Math.round(buyRatio * 100);
  if (buyRatio >= 0.82)      { score += 15; reasons.push(`Strong buy pressure: ${buyPct}% buys (+15)`); }
  else if (buyRatio >= 0.68) { score += 10; reasons.push(`Good buy pressure: ${buyPct}% buys (+10)`); }
  else if (buyRatio >= 0.55) { score += 5;  reasons.push(`Slight buy pressure: ${buyPct}% buys (+5)`); }
  else if (buyRatio < 0.40 && total > 20) {
    score -= 15;
    reasons.push(`🔴 SELL PRESSURE: ${buyPct}% buys (-15)`);
  }

  const uniq = trades ? trades.uniqueBuyers : 0;
  if (uniq >= 40)      { score += 10; reasons.push(`${uniq} unique buyers (+10)`); }
  else if (uniq >= 20) { score += 7;  reasons.push(`${uniq} unique buyers (+7)`); }
  else if (uniq >= 10) { score += 4;  reasons.push(`${uniq} unique buyers (+4)`); }
  else                 {              reasons.push(`Only ${uniq} unique buyers (+0)`); }

  const initMcap = creation.marketCapSol || 1;
  const currMcap = current && current.usd_market_cap ? current.usd_market_cap / 150 : 0;
  if (currMcap > initMcap) {
    const mult = currMcap / initMcap;
    if (mult >= 8)        { score += 10; reasons.push(`${mult.toFixed(1)}x market cap growth (+10)`); }
    else if (mult >= 4)   { score += 7;  reasons.push(`${mult.toFixed(1)}x market cap growth (+7)`); }
    else if (mult >= 2)   { score += 4;  reasons.push(`${mult.toFixed(1)}x market cap growth (+4)`); }
    else if (mult >= 1.5) { score += 2;  reasons.push(`${mult.toFixed(1)}x market cap growth (+2)`); }
  }

  const replies = current ? (current.reply_count || 0) : 0;
  if (replies >= 30)      { score += 10; reasons.push(`High engagement: ${replies} replies (+10)`); }
  else if (replies >= 15) { score += 6;  reasons.push(`Good engagement: ${replies} replies (+6)`); }
  else if (replies >= 5)  { score += 3;  reasons.push(`Some engagement: ${replies} replies (+3)`); }

  if (current && current.king_of_the_hill_timestamp) {
    score += 8;
    reasons.push('👑 King of the Hill (+8)');
  }

  let meta = 0;
  if (current && current.image_uri)   meta++;
  if (current && current.description && current.description.length > 20) meta += 2;
  if (current && current.twitter)     meta++;
  if (current && current.telegram)    meta++;
  score += meta;
  if (meta > 0) reasons.push(`Metadata: ${meta}/5 (+${meta})`);

  if (current && !current.complete) {
    score += 5;
    reasons.push('Still on bonding curve — early (+5)');
  }

  if (trades && trades.creatorSold) {
    score -= 30;
    reasons.push('🚨 CREATOR SOLD ALREADY! (-30)');
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// ─── LEARN FROM OUTCOMES ──────────────────────────────────
async function learnFromOutcome(mint, buyerWallets) {
  try {
    const data = await httpsGet(`https://pumpportal.fun/api/coins/${mint}`);
    if (!data || !data.usd_market_cap) return;
    if (data.usd_market_cap >= 200000) {
      let newWhales = 0;
      for (const wallet of buyerWallets) {
        if (!whaleWallets.has(wallet)) {
          whaleWallets.add(wallet);
          newWhales++;
        }
      }
      if (newWhales > 0) {
        console.log(`📚 Learned ${newWhales} new whale wallets from ${data.name} ($${Math.round(data.usd_market_cap/1000)}k mcap). Total: ${whaleWallets.size}`);
      }
    }
  } catch (e) {}
}

// ─── ANALYZE TOKEN AFTER 10 MIN ───────────────────────────
async function analyzeToken(mint) {
  if (alreadyAlerted.has(mint)) return;
  const creation = pendingTokens.get(mint);
  if (!creation) return;
  pendingTokens.delete(mint);

  const trades = tokenTrades.get(mint);
  const name   = creation.name || 'Unknown';

  console.log(`\n🔍 Analyzing ${name} (${mint.substring(0,8)}...)`);
  console.log(`   buys=${trades?.buys||0} sells=${trades?.sells||0} vol=${trades?.volumeSol?.toFixed(2)||0} SOL unique=${trades?.uniqueBuyers||0}`);

  const detectedWhales = [];
  if (trades && trades.buyerList) {
    for (const wallet of trades.buyerList) {
      if (whaleWallets.has(wallet)) detectedWhales.push(wallet);
    }
  }

  let current = null;
  try {
    current = await httpsGet(`https://pumpportal.fun/api/coins/${mint}`);
  } catch (e) {
    console.log(`⚠️ Could not fetch data for ${name}`);
  }

  const { score, reasons } = scoreToken(creation, current, trades, detectedWhales);
  console.log(`📊 Score: ${score}/100`);
  reasons.forEach(r => console.log(`   • ${r}`));

  if (score < MIN_SCORE) {
    console.log(`❌ Score ${score} < ${MIN_SCORE} — skip\n`);
    tokenTrades.delete(mint);
    return;
  }

  alreadyAlerted.add(mint);
  console.log(`🚨 PASSES! Sending alert...\n`);

  const mcapUSD = current ? (current.usd_market_cap || 0) : 0;

  await sendToN8N({
    name:            current?.name || creation.name,
    symbol:          current?.symbol || creation.symbol,
    mint,
    score,
    reasons:         reasons.join('\n'),
    market_cap_usd:  Math.round(mcapUSD),
    initial_buy_sol: creation.solAmount,
    volume_sol:      trades?.volumeSol?.toFixed(2) || '0',
    unique_buyers:   trades?.uniqueBuyers || 0,
    buy_count:       trades?.buys || 0,
    sell_count:      trades?.sells || 0,
    whale_detected:  detectedWhales.length > 0,
    whale_count:     detectedWhales.length,
    reply_count:     current?.reply_count || 0,
    king_of_hill:    !!(current?.king_of_the_hill_timestamp),
    still_early:     !(current?.complete),
    description:     (current?.description || '').substring(0, 120),
    pump_url:        `https://pump.fun/${mint}`,
    analyzed_at:     new Date().toISOString()
  });

  if (trades && trades.buyerList && trades.buyerList.length > 0) {
    setTimeout(() => learnFromOutcome(mint, trades.buyerList), WHALE_CHECK_DELAY_MS);
  }

  tokenTrades.delete(mint);
}

// ─── WEBSOCKET ────────────────────────────────────────────
function connect() {
  console.log('🔌 Connecting to PumpPortal...');
  const ws = new WebSocket('wss://pumpportal.fun/api/data');

  ws.on('open', () => {
    console.log('✅ Connected! Subscribing to new tokens...');
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.txType === 'create') {
        const sol  = msg.solAmount || 0;
        const name = msg.name || 'Unknown';
        const mint = msg.mint;
        if (!mint) return;

        if (pendingTokens.size >= MAX_TOKENS) {
          const firstKey = pendingTokens.keys().next().value;
          pendingTokens.delete(firstKey);
          tokenTrades.delete(firstKey);
        }

        if (sol < MIN_INITIAL_BUY_SOL) {
          console.log(`⏭️  Skip ${name} — only ${sol} SOL`);
          return;
        }

        console.log(`💾 Queued: ${name} ($${msg.symbol}) — ${sol} SOL — analyzing in 10 min`);
        pendingTokens.set(mint, { ...msg, timestamp: Date.now() });
        tokenTrades.set(mint, { buys: 0, sells: 0, volumeSol: 0, uniqueBuyers: 0, buyerList: [], creatorSold: false });
        ws.send(JSON.stringify({ method: 'subscribeTokenTrade', keys: [mint] }));
        setTimeout(() => analyzeToken(mint), ANALYSIS_DELAY_MS);
      }

      else if (msg.txType === 'buy' || msg.txType === 'sell') {
        const mint   = msg.mint;
        const trader = msg.traderPublicKey;
        const trades = tokenTrades.get(mint);
        if (!trades) return;

        const solAmt = msg.solAmount || 0;

        if (msg.txType === 'buy') {
          trades.buys++;
          trades.volumeSol += solAmt;
          if (trader && !trades.buyerList.includes(trader)) {
            trades.buyerList.push(trader);
            trades.uniqueBuyers++;

            if (WHALE_ALERT_IMMEDIATE && whaleWallets.has(trader) && !alreadyAlerted.has(mint)) {
              const creation = pendingTokens.get(mint);
              if (creation) {
                console.log(`🐳 WHALE ALERT: ${trader.substring(0,8)}... bought ${creation.name}!`);
                alreadyAlerted.add(mint);
                sendToN8N({
                  name:            creation.name,
                  symbol:          creation.symbol,
                  mint,
                  score:           90,
                  reasons:         `🐳 Known whale wallet buying!\nWallet: ${trader.substring(0,12)}...\nBought: ${solAmt} SOL`,
                  market_cap_usd:  Math.round((creation.marketCapSol || 0) * 150),
                  initial_buy_sol: creation.solAmount,
                  volume_sol:      trades.volumeSol.toFixed(2),
                  unique_buyers:   trades.uniqueBuyers,
                  whale_detected:  true,
                  whale_count:     1,
                  pump_url:        `https://pump.fun/${mint}`,
                  alert_type:      'WHALE_IMMEDIATE',
                  analyzed_at:     new Date().toISOString()
                });
              }
            }
          }
        } else {
          trades.sells++;
          const creation = pendingTokens.get(mint);
          if (creation && trader === creation.traderPublicKey) {
            trades.creatorSold = true;
            console.log(`🚨 Creator selling early on ${creation.name}!`);
          }
        }
      }

    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('⚠️ Disconnected. Reconnecting in 5s...');
    setTimeout(connect, 5000);
  });

  ws.on('error', (e) => console.error('WS error:', e.message));
}

// ─── START ────────────────────────────────────────────────
console.log('🚀 Pump.fun Smart Scanner v2.1');
console.log(`   Min initial buy : ${MIN_INITIAL_BUY_SOL} SOL`);
console.log(`   Analysis delay  : 10 minutes`);
console.log(`   Min score       : ${MIN_SCORE}/100`);
console.log(`   Whale learning  : enabled (GMGN + auto-learn)`);
console.log('');

// Load GMGN whales immediately, then refresh every 6 hours
refreshWhaleWallets();
setInterval(refreshWhaleWallets, 6 * 60 * 60 * 1000);

connect();
