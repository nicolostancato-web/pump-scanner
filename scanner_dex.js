const WebSocket = require('ws');
const https = require('https');

// ─── CONFIG ───────────────────────────────────────────────
const N8N_WEBHOOK          = 'https://nikbumme.app.n8n.cloud/webhook/dex-scanner';
const MIN_SCORE            = 72;
const SCAN_INTERVAL_MS     = 2 * 60 * 1000;   // scan every 2 min
const WHALE_CHECK_DELAY_MS = 30 * 60 * 1000;  // learn from outcomes after 30 min
const WHALE_BONUS          = 25;
const MAX_TOKEN_AGE_HOURS  = 2;                // only tokens < 2 hours old
const MIN_LIQUIDITY_USD    = 10000;            // min $10k liquidity
const MIN_VOLUME_5M_USD    = 5000;             // min $5k volume in 5 min
const ALREADY_ALERTED      = new Set();
const whaleWallets         = new Set();

// ─── UTILS ────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dex-scanner/1.0)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
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
      for (const w of data.data.rank) {
        if (w.wallet && !whaleWallets.has(w.wallet)) {
          whaleWallets.add(w.wallet);
          added++;
        }
      }
      console.log(`🐳 GMGN: ${added} new whale wallets loaded. Total: ${whaleWallets.size}`);
    }
  } catch (e) {
    console.log(`⚠️ GMGN fetch failed: ${e.message}`);
  }
}

// ─── SCORING ──────────────────────────────────────────────
function scoreToken(pair) {
  let score = 0;
  const reasons = [];
  const now = Date.now();

  // 1. AGE — must be < 2 hours, sweet spot 10-60 min (max 15 pts)
  const ageMs  = now - (pair.pairCreatedAt || now);
  const ageMin = ageMs / 60000;
  if (ageMin >= 10 && ageMin <= 60)       { score += 15; reasons.push(`Sweet spot age: ${Math.round(ageMin)} min (+15)`); }
  else if (ageMin > 60 && ageMin <= 120)  { score += 8;  reasons.push(`Age: ${Math.round(ageMin)} min (+8)`); }
  else if (ageMin < 10)                   { score += 5;  reasons.push(`Very new: ${Math.round(ageMin)} min (+5)`); }
  else { return { score: 0, reasons: ['Too old'] }; }

  // 2. VOLUME 5 MIN (max 20 pts) — explosion in last 5 min = momentum
  const vol5m = pair.volume?.m5 || 0;
  if (vol5m >= 100000)      { score += 20; reasons.push(`🔥 Massive 5m volume: $${Math.round(vol5m/1000)}k (+20)`); }
  else if (vol5m >= 50000)  { score += 16; reasons.push(`High 5m volume: $${Math.round(vol5m/1000)}k (+16)`); }
  else if (vol5m >= 20000)  { score += 12; reasons.push(`Good 5m volume: $${Math.round(vol5m/1000)}k (+12)`); }
  else if (vol5m >= 5000)   { score += 7;  reasons.push(`Decent 5m volume: $${Math.round(vol5m/1000)}k (+7)`); }
  else                      {              reasons.push(`Low 5m volume: $${Math.round(vol5m)} (+0)`); }

  // 3. BUY/SELL RATIO 5 MIN (max 15 pts)
  const buys5  = pair.txns?.m5?.buys || 0;
  const sells5 = pair.txns?.m5?.sells || 0;
  const total5 = buys5 + sells5;
  const ratio  = total5 > 0 ? buys5 / total5 : 0;
  const pct    = Math.round(ratio * 100);
  if (ratio >= 0.80)       { score += 15; reasons.push(`Strong buying: ${pct}% buys (+15)`); }
  else if (ratio >= 0.65)  { score += 10; reasons.push(`Good buying: ${pct}% buys (+10)`); }
  else if (ratio >= 0.55)  { score += 5;  reasons.push(`Slight buying: ${pct}% buys (+5)`); }
  else if (ratio < 0.40 && total5 > 10) {
    score -= 15;
    reasons.push(`🔴 Sell pressure: ${pct}% buys (-15)`);
  }

  // 4. PRICE CHANGE 5 MIN (max 15 pts) — momentum
  const change5m = pair.priceChange?.m5 || 0;
  if (change5m >= 50)       { score += 15; reasons.push(`🚀 Price +${change5m.toFixed(1)}% in 5min (+15)`); }
  else if (change5m >= 20)  { score += 10; reasons.push(`📈 Price +${change5m.toFixed(1)}% in 5min (+10)`); }
  else if (change5m >= 10)  { score += 6;  reasons.push(`📈 Price +${change5m.toFixed(1)}% in 5min (+6)`); }
  else if (change5m >= 0)   { score += 2;  reasons.push(`Price +${change5m.toFixed(1)}% in 5min (+2)`); }
  else                      {
    score -= 10;
    reasons.push(`📉 Price ${change5m.toFixed(1)}% in 5min (-10)`);
  }

  // 5. LIQUIDITY (max 10 pts) — enough to trade without huge slippage
  const liq = pair.liquidity?.usd || 0;
  if (liq >= 100000)       { score += 10; reasons.push(`High liquidity: $${Math.round(liq/1000)}k (+10)`); }
  else if (liq >= 50000)   { score += 7;  reasons.push(`Good liquidity: $${Math.round(liq/1000)}k (+7)`); }
  else if (liq >= 10000)   { score += 4;  reasons.push(`Decent liquidity: $${Math.round(liq/1000)}k (+4)`); }
  else {
    score -= 10;
    reasons.push(`⚠️ Low liquidity: $${Math.round(liq)} (-10)`);
  }

  // 6. MARKET CAP SWEET SPOT (max 10 pts)
  const mcap = pair.marketCap || pair.fdv || 0;
  if (mcap >= 100000 && mcap <= 2000000)      { score += 10; reasons.push(`Sweet spot mcap: $${Math.round(mcap/1000)}k (+10)`); }
  else if (mcap >= 50000 && mcap < 100000)    { score += 7;  reasons.push(`Early mcap: $${Math.round(mcap/1000)}k (+7)`); }
  else if (mcap >= 2000000 && mcap < 10000000){ score += 5;  reasons.push(`Growing mcap: $${Math.round(mcap/1000)}k (+5)`); }
  else if (mcap > 0 && mcap < 50000)          { score += 3;  reasons.push(`Very early mcap: $${Math.round(mcap/1000)}k (+3)`); }

  // 7. SOCIAL LINKS (max 8 pts)
  const socials  = pair.info?.socials || [];
  const hasTwitter   = socials.some(s => s.type === 'twitter');
  const hasTelegram  = socials.some(s => s.type === 'telegram');
  const hasWebsite   = (pair.info?.websites || []).length > 0;
  if (hasTwitter)  { score += 3; reasons.push('✅ Has Twitter (+3)'); }
  if (hasTelegram) { score += 3; reasons.push('✅ Has Telegram (+3)'); }
  if (hasWebsite)  { score += 2; reasons.push('✅ Has Website (+2)'); }

  // 8. VOLUME 1H (max 7 pts) — sustained interest
  const vol1h = pair.volume?.h1 || 0;
  if (vol1h >= 500000)      { score += 7; reasons.push(`High 1h volume: $${Math.round(vol1h/1000)}k (+7)`); }
  else if (vol1h >= 100000) { score += 5; reasons.push(`Good 1h volume: $${Math.round(vol1h/1000)}k (+5)`); }
  else if (vol1h >= 50000)  { score += 3; reasons.push(`Decent 1h volume: $${Math.round(vol1h/1000)}k (+3)`); }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// ─── SCAN DEXSCREENER ─────────────────────────────────────
async function scanDexScreener() {
  try {
    console.log(`\n🔍 Scanning DexScreener for new Solana tokens...`);

    // Get latest token profiles
    const profiles = await httpsGet('https://api.dexscreener.com/token-profiles/latest/v1');
    if (!profiles || !Array.isArray(profiles)) {
      console.log('⚠️ No profiles returned');
      return;
    }

    // Filter Solana tokens only
    const solAddresses = profiles
      .filter(p => p.chainId === 'solana')
      .map(p => p.tokenAddress)
      .filter(Boolean)
      .slice(0, 30);

    if (solAddresses.length === 0) {
      console.log('⚠️ No Solana tokens found');
      return;
    }

    // Get market data in batches of 30
    const marketData = await httpsGet(`https://api.dexscreener.com/latest/dex/tokens/${solAddresses.join(',')}`);
    if (!marketData || !marketData.pairs) {
      console.log('⚠️ No market data returned');
      return;
    }

    const now = Date.now();
    let analyzed = 0;
    let passed = 0;

    for (const pair of marketData.pairs) {
      // Skip if already alerted
      const pairKey = pair.pairAddress || pair.baseToken?.address;
      if (!pairKey || ALREADY_ALERTED.has(pairKey)) continue;

      // Skip non-Solana or non-new pairs
      if (pair.chainId !== 'solana') continue;
      const ageMs = now - (pair.pairCreatedAt || now);
      if (ageMs > MAX_TOKEN_AGE_HOURS * 60 * 60 * 1000) continue;

      // Skip low liquidity
      if ((pair.liquidity?.usd || 0) < MIN_LIQUIDITY_USD) continue;

      analyzed++;
      const { score, reasons } = scoreToken(pair);

      const name   = pair.baseToken?.name || 'Unknown';
      const symbol = pair.baseToken?.symbol || '???';
      console.log(`   ${name} ($${symbol}) — Score: ${score}/100`);

      if (score < MIN_SCORE) continue;

      passed++;
      ALREADY_ALERTED.add(pairKey);

      const mcap    = pair.marketCap || pair.fdv || 0;
      const vol5m   = pair.volume?.m5 || 0;
      const vol1h   = pair.volume?.h1 || 0;
      const liq     = pair.liquidity?.usd || 0;
      const change5m= pair.priceChange?.m5 || 0;
      const change1h= pair.priceChange?.h1 || 0;
      const buys5   = pair.txns?.m5?.buys || 0;
      const sells5  = pair.txns?.m5?.sells || 0;
      const ageMin  = Math.round(ageMs / 60000);

      const socials   = pair.info?.socials || [];
      const twitter   = socials.find(s => s.type === 'twitter')?.url || '';
      const telegram  = socials.find(s => s.type === 'telegram')?.url || '';
      const website   = (pair.info?.websites || [])[0]?.url || '';

      console.log(`🚨 PASSES! Sending alert for ${name}...`);

      await sendToN8N({
        source:          'DEXSCREENER',
        name,
        symbol,
        mint:            pair.baseToken?.address || '',
        pair_address:    pairKey,
        dex:             pair.dexId || '',
        score,
        reasons:         reasons.join('\n'),
        market_cap_usd:  Math.round(mcap),
        liquidity_usd:   Math.round(liq),
        volume_5m_usd:   Math.round(vol5m),
        volume_1h_usd:   Math.round(vol1h),
        price_change_5m: change5m.toFixed(2),
        price_change_1h: change1h.toFixed(2),
        buys_5m:         buys5,
        sells_5m:        sells5,
        age_minutes:     ageMin,
        twitter,
        telegram,
        website,
        pair_url:        pair.url || `https://dexscreener.com/solana/${pairKey}`,
        pump_url:        `https://pump.fun/${pair.baseToken?.address || ''}`,
        analyzed_at:     new Date().toISOString()
      });
    }

    console.log(`✅ Scan complete: analyzed ${analyzed} tokens, ${passed} passed filters`);

  } catch (e) {
    console.error('❌ Scan error:', e.message);
  }
}

// ─── START ────────────────────────────────────────────────
console.log('🚀 DexScreener Smart Scanner v1.0');
console.log(`   Min score        : ${MIN_SCORE}/100`);
console.log(`   Max token age    : ${MAX_TOKEN_AGE_HOURS} hours`);
console.log(`   Min liquidity    : $${MIN_LIQUIDITY_USD/1000}k`);
console.log(`   Scan interval    : every 2 minutes`);
console.log(`   Whale learning   : enabled (GMGN + auto)`);
console.log('');

// Load whale wallets
refreshWhaleWallets();
setInterval(refreshWhaleWallets, 6 * 60 * 60 * 1000);

// Start scanning
scanDexScreener();
setInterval(scanDexScreener, SCAN_INTERVAL_MS);
