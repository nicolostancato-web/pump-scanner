const WebSocket = require('ws');
const https = require('https');

// ─── CONFIG ───────────────────────────────────────────────
const N8N_WEBHOOK = 'https://nikbumme.app.n8n.cloud/webhook/pump-scanner';
const MIN_INITIAL_BUY_SOL = 0.5;   // ignore tokens with tiny initial buy
const ANALYSIS_DELAY_MS   = 10 * 60 * 1000; // wait 10 min before scoring
const MIN_SCORE            = 75;             // only alert if score >= 75
const MAX_TRACKED_TOKENS   = 500;            // memory limit
// ──────────────────────────────────────────────────────────

// In-memory store: mint -> tokenData
const pendingTokens = new Map();

// ─── UTILITIES ────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'pump-scanner/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    }).on('error', reject);
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
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(opts, (res) => {
      console.log(`✅ Sent to n8n — HTTP ${res.statusCode}`);
      resolve();
    });
    req.on('error', (e) => {
      console.error('❌ n8n send error:', e.message);
      resolve();
    });
    req.write(data);
    req.end();
  });
}

// ─── PHASE 3: FETCH UPDATED DATA ─────────────────────────
async function fetchTokenData(mint) {
  try {
    // Get coin data from PumpPortal
    const coin = await httpsGet(`https://pumpportal.fun/api/coins/${mint}`);
    return coin;
  } catch (e) {
    console.error(`❌ Failed to fetch data for ${mint}:`, e.message);
    return null;
  }
}

// ─── PHASE 4: ADVANCED SCORING ───────────────────────────
function scoreToken(creation, current) {
  let score = 0;
  const reasons = [];

  // 1. INITIAL BUY SIZE (max 15 pts)
  // Bigger initial buy = creator has skin in the game
  const initSol = creation.solAmount || 0;
  if (initSol >= 5)       { score += 15; reasons.push(`Big initial buy: ${initSol} SOL (+15)`); }
  else if (initSol >= 2)  { score += 12; reasons.push(`Good initial buy: ${initSol} SOL (+12)`); }
  else if (initSol >= 1)  { score += 8;  reasons.push(`Initial buy: ${initSol} SOL (+8)`); }
  else if (initSol >= 0.5){ score += 4;  reasons.push(`Small initial buy: ${initSol} SOL (+4)`); }

  // 2. MARKET CAP GROWTH (max 20 pts)
  // How much did it grow in 10 minutes?
  const initMcap    = creation.marketCapSol || 0;
  const currentMcap = current.usd_market_cap ? current.usd_market_cap / 150 : 0; // rough SOL conversion
  if (initMcap > 0 && currentMcap > initMcap) {
    const growth = currentMcap / initMcap;
    if (growth >= 10)      { score += 20; reasons.push(`10x market cap growth (+20)`); }
    else if (growth >= 5)  { score += 15; reasons.push(`5x market cap growth (+15)`); }
    else if (growth >= 3)  { score += 10; reasons.push(`3x market cap growth (+10)`); }
    else if (growth >= 2)  { score += 6;  reasons.push(`2x market cap growth (+6)`); }
    else if (growth >= 1.5){ score += 3;  reasons.push(`1.5x market cap growth (+3)`); }
  }

  // 3. ABSOLUTE MARKET CAP (max 15 pts)
  // Sweet spot: still early but not dead
  const mcapUSD = current.usd_market_cap || 0;
  if (mcapUSD >= 50000 && mcapUSD <= 500000)      { score += 15; reasons.push(`Sweet spot mcap $${Math.round(mcapUSD/1000)}k (+15)`); }
  else if (mcapUSD >= 20000 && mcapUSD < 50000)   { score += 10; reasons.push(`Early mcap $${Math.round(mcapUSD/1000)}k (+10)`); }
  else if (mcapUSD >= 500000 && mcapUSD < 2000000){ score += 8;  reasons.push(`Growing mcap $${Math.round(mcapUSD/1000)}k (+8)`); }
  else if (mcapUSD > 0 && mcapUSD < 20000)        { score += 2;  reasons.push(`Very early mcap $${Math.round(mcapUSD/1000)}k (+2)`); }

  // 4. REPLY COUNT / SOCIAL ENGAGEMENT (max 15 pts)
  // Real community = people talking about it
  const replies = current.reply_count || 0;
  if (replies >= 50)      { score += 15; reasons.push(`High engagement: ${replies} replies (+15)`); }
  else if (replies >= 20) { score += 10; reasons.push(`Good engagement: ${replies} replies (+10)`); }
  else if (replies >= 10) { score += 7;  reasons.push(`Some engagement: ${replies} replies (+7)`); }
  else if (replies >= 5)  { score += 4;  reasons.push(`Low engagement: ${replies} replies (+4)`); }
  else                    { score += 0;  reasons.push(`Almost no engagement: ${replies} replies (+0)`); }

  // 5. TRANSACTION VELOCITY (max 15 pts)
  // Many transactions in 10 min = real interest
  const txCount = current.total_supply ? 0 : 0; // fallback
  const trades  = current.trade_24h_count || 0;
  if (trades >= 500)      { score += 15; reasons.push(`Very high trades: ${trades} (+15)`); }
  else if (trades >= 200) { score += 10; reasons.push(`High trades: ${trades} (+10)`); }
  else if (trades >= 100) { score += 7;  reasons.push(`Good trades: ${trades} (+7)`); }
  else if (trades >= 50)  { score += 4;  reasons.push(`Some trades: ${trades} (+4)`); }
  else if (trades >= 20)  { score += 2;  reasons.push(`Few trades: ${trades} (+2)`); }

  // 6. KING OF THE HILL (max 10 pts)
  // Pump.fun promotes these — means strong momentum
  if (current.king_of_the_hill_timestamp) {
    score += 10;
    reasons.push('King of the Hill 👑 (+10)');
  }

  // 7. COMPLETE METADATA (max 5 pts)
  // Rugs usually have no description, no socials
  let metaScore = 0;
  if (current.image_uri)   metaScore += 1;
  if (current.description && current.description.length > 20) metaScore += 2;
  if (current.twitter)     metaScore += 1;
  if (current.telegram)    metaScore += 1;
  score += metaScore;
  if (metaScore > 0) reasons.push(`Metadata complete (+${metaScore})`);

  // 8. NOT COMPLETED (still on bonding curve) (max 5 pts)
  // If complete = already graduated, we might be too late
  if (!current.complete) {
    score += 5;
    reasons.push('Still on bonding curve — early (+5)');
  }

  return { score, reasons };
}

// ─── PHASE 2: SCHEDULED ANALYSIS ─────────────────────────
async function analyzeToken(mint) {
  const creation = pendingTokens.get(mint);
  if (!creation) return;
  pendingTokens.delete(mint);

  console.log(`\n🔍 Analyzing ${creation.name} (${mint.substring(0,8)}...)...`);

  const current = await fetchTokenData(mint);
  if (!current || !current.mint) {
    console.log(`⚠️ No data found for ${creation.name} — probably dead`);
    return;
  }

  const { score, reasons } = scoreToken(creation, current);
  const mcapUSD = current.usd_market_cap || 0;

  console.log(`📊 Score: ${score}/100`);
  reasons.forEach(r => console.log(`   • ${r}`));

  if (score < MIN_SCORE) {
    console.log(`❌ Score ${score} < ${MIN_SCORE} — skip\n`);
    return;
  }

  console.log(`🚨 PASSES! Sending to Telegram...\n`);

  await sendToN8N({
    name:            current.name || creation.name,
    symbol:          current.symbol || creation.symbol,
    mint:            mint,
    score:           score,
    reasons:         reasons.join('\n'),
    market_cap_usd:  Math.round(mcapUSD),
    initial_buy_sol: creation.solAmount,
    reply_count:     current.reply_count || 0,
    trades:          current.trade_24h_count || 0,
    king_of_hill:    !!current.king_of_the_hill_timestamp,
    still_early:     !current.complete,
    description:     (current.description || '').substring(0, 100),
    pump_url:        `https://pump.fun/${mint}`,
    created_at:      new Date(creation.timestamp).toISOString(),
    analyzed_at:     new Date().toISOString()
  });
}

// ─── PHASE 1: WEBSOCKET LISTENER ─────────────────────────
function connect() {
  console.log('🔌 Connecting to PumpPortal WebSocket...');
  const ws = new WebSocket('wss://pumpportal.fun/api/data');

  ws.on('open', () => {
    console.log('✅ Connected! Subscribing to new tokens...');
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
  });

  ws.on('message', (raw) => {
    try {
      const token = JSON.parse(raw);
      if (token.txType !== 'create') return;

      const sol = token.solAmount || 0;
      const name = token.name || 'Unknown';

      // Memory guard
      if (pendingTokens.size >= MAX_TRACKED_TOKENS) {
        const firstKey = pendingTokens.keys().next().value;
        pendingTokens.delete(firstKey);
      }

      // Phase 1 filter: ignore tiny initial buys
      if (sol < MIN_INITIAL_BUY_SOL) {
        console.log(`⏭️  Skip ${name} — initial buy only ${sol} SOL (< ${MIN_INITIAL_BUY_SOL})`);
        return;
      }

      console.log(`💾 Queued ${name} (${sol} SOL initial buy) — analyzing in 10 min`);
      pendingTokens.set(token.mint, {
        ...token,
        timestamp: Date.now()
      });

      // Schedule deep analysis in 10 minutes
      setTimeout(() => analyzeToken(token.mint), ANALYSIS_DELAY_MS);

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
console.log('🚀 Pump.fun Smart Scanner starting...');
console.log(`   Min initial buy: ${MIN_INITIAL_BUY_SOL} SOL`);
console.log(`   Analysis delay:  10 minutes`);
console.log(`   Min score:       ${MIN_SCORE}/100`);
console.log('');
connect();
