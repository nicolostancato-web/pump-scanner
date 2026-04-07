const WebSocket = require('ws');
const https = require('https');
const N8N_WEBHOOK = 'https://nikbumme.app.n8n.cloud/webhook/pump-scanner';
const MIN_SCORE = 50;
function scoreToken(token) {
  let score = 0;
  const sol = token.solAmount || 0;
  if (sol >= 2) score += 40;
  else if (sol >= 1) score += 30;
  else if (sol >= 0.5) score += 20;
  else if (sol >= 0.1) score += 10;
  if (token.uri) score += 15;
  if (token.name && token.symbol) score += 10;
  if (token.name && token.name.length >= 4) score += 5;
  const mcap = token.marketCapSol || 0;
  if (mcap >= 20 && mcap <= 100) score += 15;
  else if (mcap > 0) score += 5;
  return score;
}
function sendToN8N(payload) {
  const data = JSON.stringify(payload);
  const url = new URL(N8N_WEBHOOK);
  const options = { hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
  const req = https.request(options, (res) => { console.log('Sent to n8n, status: ' + res.statusCode); });
  req.on('error', (e) => console.error('n8n error:', e.message));
  req.write(data);
  req.end();
}
function connect() {
  console.log('Connecting to PumpPortal...');
  const ws = new WebSocket('wss://pumpportal.fun/api/data');
  ws.on('open', () => { console.log('Connected! Listening for new tokens...'); ws.send(JSON.stringify({ method: 'subscribeNewToken' })); });
  ws.on('message', (raw) => {
    try {
      const token = JSON.parse(raw);
      if (token.txType !== 'create') return;
      const score = scoreToken(token);
      console.log('New token: ' + token.name + ' score: ' + score);
      if (score >= MIN_SCORE) {
        sendToN8N({ name: token.name, symbol: token.symbol, mint: token.mint, creator: token.traderPublicKey, initial_buy_sol: token.solAmount, market_cap_sol: token.marketCapSol, score: score, pump_url: 'https://pump.fun/' + token.mint, created_at: new Date().toISOString() });
      }
    } catch (e) { console.error('Error:', e.message); }
  });
  ws.on('close', () => { console.log('Disconnected. Reconnecting in 5s...'); setTimeout(connect, 5000); });
  ws.on('error', (e) => console.error('WS error:', e.message));
}
connect();
