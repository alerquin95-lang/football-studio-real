import http from 'http';
import fs from 'fs';

const SUPABASE_URL = 'https://ulzvxigcdcwbyfnpewjc.supabase.co';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';

let SUPABASE_AUTH_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwNDI5NTAwLCJpYXQiOjE3OTA0MjU5MDAsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.TJef0QdVhjkcaEiEKci95bARRFPUlkqwlWKQfsYNuqkjK5ge4FGzjpCJx3RDv3JOxhyXGvB0-RcA8xAU__b6EA';

const SITE_USER = 'santarosavander@gmail.com';
const SITE_PASS = '131619jV*';

let history = [];
let stats = { HOME: 0, AWAY: 0, TIE: 0 };
let botStatus = 'Conectando...';
let lastError = '';

function loadHistory() {
  try {
    if (fs.existsSync('./token.json')) {
      const tj = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
      if (tj.token) SUPABASE_AUTH_TOKEN = tj.token;
    }
    if (fs.existsSync('./history.json')) {
      const d = JSON.parse(fs.readFileSync('./history.json', 'utf8'));
      history = Array.isArray(d) ? d.slice(0, 400) : [];
      stats = { HOME: 0, AWAY: 0, TIE: 0 };
      history.forEach(h => {
        if (stats[h.winner] !== undefined) stats[h.winner]++;
      });
    }
  } catch (e) {
    console.log('Erro carregando histórico:', e.message);
  }
}

function saveHistory() {
  try {
    fs.writeFileSync('./history.json', JSON.stringify(history.slice(0, 400), null, 2));
  } catch (e) {
    console.log('Erro salvando histórico:', e.message);
  }
}

function normalizeWinner(raw) {
  const s = (raw || '').toString().trim().toUpperCase();
  if (['HOME', 'H', 'CASA', '1', 'RED', 'R', 'PLAYER'].includes(s)) return 'HOME';
  if (['AWAY', 'A', 'FORA', '2', 'BLUE', 'B', 'BANKER'].includes(s)) return 'AWAY';
  if (['TIE', 'T', 'EMPATE', '0', 'X', 'E', 'YELLOW'].includes(s)) return 'TIE';
  if (s.includes('HOME') || s.includes('PLAYER')) return 'HOME';
  if (s.includes('AWAY') || s.includes('BANKER')) return 'AWAY';
  if (s.includes('TIE') || s.includes('DRAW')) return 'TIE';
  return null;
}

function inferWinnerFromRow(row) {
  let raw = row.winner || row.result || row.outcome || row.winning_side || row.side || '';
  let norm = normalizeWinner(raw);
  if (norm) return norm;
  if (row.home_score != null && row.away_score != null) {
    const home = Number(row.home_score);
    const away = Number(row.away_score);
    if (home > away) return 'HOME';
    if (away > home) return 'AWAY';
    return 'TIE';
  }
  return null;
}

function addResult(w, row) {
  if (row?.id && history.some(h => h.round_id === row.id)) return false;
  const e = {
    round_id: row.id || null,
    winner: w,
    home_score: row.home_score != null ? Number(row.home_score) : null,
    away_score: row.away_score != null ? Number(row.away_score) : null,
    created_at: row.created_at || new Date().toISOString(),
    time: new Date().toLocaleTimeString('pt-BR')
  };
  history.unshift(e);
  if (history.length > 400) history.pop();
  stats[w] = (stats[w] || 0) + 1;
  saveHistory();
  return true;
}

async function refreshTokenAuto() {
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SITE_USER, password: SITE_PASS })
    });
    const data = await res.json();
    if (data.access_token) {
      SUPABASE_AUTH_TOKEN = data.access_token;
      fs.writeFileSync('./token.json', JSON.stringify({ token: data.access_token }));
      botStatus = 'Token renovado';
      return true;
    }
    return false;
  } catch (e) { return false; }
}

async function fetchReal() {
  try {
    let headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_AUTH_TOKEN, 'Content-Type': 'application/json' };
    const url = SUPABASE_URL + '/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=400';
    let res = await fetch(url, { headers });
    if (!res.ok && res.status === 401) {
      const renewed = await refreshTokenAuto();
      if (renewed) {
        headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_AUTH_TOKEN, 'Content-Type': 'application/json' };
        res = await fetch(url, { headers });
      }
    }
    if (!res.ok) {
      lastError = await res.text();
      botStatus = 'Erro HTTP: ' + res.status;
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) return;
    let newCount = 0;
    const dbg = { HOME: 0, AWAY: 0, TIE: 0 };
    for (let j = data.length - 1; j >= 0; j--) {
      const row = data[j];
      const norm = inferWinnerFromRow(row);
      if (!norm) continue;
      dbg[norm]++;
      if (!history.some(h => h.round_id === row.id)) {
        if (addResult(norm, row)) newCount++;
      }
    }
    botStatus = '✅ LIVE • ' + history.length + '/400 • ' + stats.HOME + ' HOME • ' + stats.AWAY + ' AWAY • ' + stats.TIE + ' TIE' + (newCount ? ' • +' + newCount : '');
    lastError = '';
  } catch (e) {
    lastError = e.message;
    botStatus = 'Erro: ' + e.message;
  }
}

function cleanSequence(arr) { return arr.map(x => x.winner).filter(Boolean); }
function getRecent(limit = 20) { return history.slice(0, limit); }
function getCounts(arr) { const result = { HOME: 0, AWAY: 0, TIE: 0 }; arr.forEach(x => { if (result[x] !== undefined) result[x]++; }); return result; }
function percentage(a, b) { if (!b) return 0; return Number(((a / b) * 100).toFixed(1)); }
function currentStreak() { if (!history.length) return { type: null, length: 0 }; const first = history[0].winner; let count = 0; for (const h of history) { if (h.winner === first) count++; else break; } return { type: first, length: count }; }

function patternAnalysis() {
  const seq = cleanSequence(history);
  const result = { current: currentStreak(), last5: seq.slice(0, 5), last10: seq.slice(0, 10), last20: seq.slice(0, 20), transitions: { HOME_TO_HOME: 0, HOME_TO_AWAY: 0, AWAY_TO_HOME: 0, AWAY_TO_AWAY: 0 }, pairs: {}, triples: {}, notes: [] };
  for (let i = 0; i < seq.length - 1; i++) { const a = seq[i]; const b = seq[i + 1]; const key = a + '_TO_' + b; if (result.transitions[key] !== undefined) result.transitions[key]++; }
  for (let i = 0; i < seq.length - 1; i++) { const key = seq[i] + '>' + seq[i + 1]; result.pairs[key] = (result.pairs[key] || 0) + 1; }
  for (let i = 0; i < seq.length - 2; i++) { const key = seq[i] + '>' + seq[i + 1] + '>' + seq[i + 2]; result.triples[key] = (result.triples[key] || 0) + 1; }
  if (result.current.length >= 3) result.notes.push('Sequência repetida detectada: ' + result.current.type + ' x' + result.current.length);
  return result;
}

function findSimilarSequences(sequenceLength = 3, maxResults = 100) {
  const seq = cleanSequence(history);
  if (seq.length < sequenceLength + 1) return [];
  const current = seq.slice(0, sequenceLength);
  const matches = [];
  for (let i = sequenceLength; i < seq.length; i++) {
    const past = seq.slice(i, i + sequenceLength);
    if (past.length !== sequenceLength) continue;
    let same = true;
    for (let j = 0; j < sequenceLength; j++) { if (past[j] !== current[j]) { same = false; break; } }
    if (!same) continue;
    const next = seq[i - 1];
    if (!next) continue;
    matches.push({ index: i, sequence: past, next });
    if (matches.length >= maxResults) break;
  }
  return matches;
}

function runAnalysis() {
  const seq = cleanSequence(history);
  if (seq.length < 10) return { ready: false, message: 'Aguardando histórico suficiente.' };
  const recent10 = seq.slice(0, 10);
  const recent20 = seq.slice(0, 20);
  const recent50 = seq.slice(0, 50);
  const c10 = getCounts(recent10);
  const c20 = getCounts(recent20);
  const c50 = getCounts(recent50);
  const streak = currentStreak();
  const patterns = patternAnalysis();
  const similar3 = findSimilarSequences(3);
  const similar4 = findSimilarSequences(4);
  const following3 = getCounts(similar3.map(x => x.next));
  const following4 = getCounts(similar4.map(x => x.next));
  const candidates = ['HOME', 'AWAY'];
  const scores = { HOME: 0, AWAY: 0 };
  for (const side of candidates) {
    scores[side] += percentage(c10[side], 10) * 0.25;
    scores[side] += percentage(c20[side], 20) * 0.15;
    scores[side] += percentage(c50[side], 50) * 0.10;
    if (following3[side]) scores[side] += percentage(following3[side], similar3.length) * 0.30;
    if (following4[side]) scores[side] += percentage(following4[side], similar4.length) * 0.20;
  }
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = ordered[0];
  const second = ordered[1];
  const gap = top[1] - second[1];
  let signal = 'SEM SINAL';
  if (gap >= 15 && similar3.length >= 5) signal = 'PADRÃO HISTÓRICO FORTE';
  else if (gap >= 8 && similar3.length >= 3) signal = 'PADRÃO HISTÓRICO MODERADO';
  else if (similar3.length >= 2) signal = 'PADRÃO FRACO';
  return { ready: true, signal, sequence: seq.slice(0, 15), streak, recent: { c10, c20, c50 }, similar: { three: { occurrences: similar3.length, following: following3 }, four: { occurrences: similar4.length, following: following4 } }, scores, gap: Number(gap.toFixed(1)), historicalSample: seq.length, disclaimer: 'Análise baseada somente no histórico. Sequências passadas não garantem o próximo resultado.' };
}

function analysisResponse() { return { success: true, analysis: runAnalysis() }; }

function getHtml() {
  const total = history.length;
  const homePct = percentage(stats.HOME, total);
  const awayPct = percentage(stats.AWAY, total);
  const tiePct = percentage(stats.TIE, total);
  const streak = currentStreak();
  const bolas = history.map(h => {
    const cls = h.winner === 'HOME' ? 'home' : h.winner === 'AWAY' ? 'away' : 'tie';
    return `<div class="ball ${cls}">${h.winner[0]}</div>`;
  }).join('');
  const linhas = history.map((h, i) => {
    const col = h.winner === 'HOME' ? '#ef4444' : h.winner === 'AWAY' ? '#3b82f6' : '#eab308';
    const placar = h.home_score != null && h.away_score != null ? `${h.home_score} × ${h.away_score}` : '-';
    return `<tr><td>#${total - i}</td><td><span style="color:${col};font-weight:800">${h.winner}</span></td><td>${placar}</td><td>${h.time || '-'}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vander Studio Analyzer</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
*{box-sizing:border-box;}
body{margin:0;background:radial-gradient(circle at top,#172033 0%,#070b13 45%,#03050a 100%);color:#e5e7eb;font-family:Inter,system-ui,Arial;padding:14px;}
.container{max-width:1200px;margin:auto;}
.glass{background:rgba(15,23,42,.82);border:1px solid rgba(255,255,255,.07);box-shadow:0 15px 40px rgba(0,0,0,.25);border-radius:20px;padding:18px;backdrop-filter:blur(15px);}
.header{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:14px;}
.logo{font-size:23px;font-weight:900;letter-spacing:-1px;}
.logo span{color:#10b981;}
.live{color:#10b981;font-size:12px;font-weight:800;}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;}
.card{padding:17px;border-radius:18px;background:rgba(15,23,42,.75);border:1px solid rgba(255,255,255,.06);}
.label{color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase;}
.number{font-size:29px;font-weight:900;margin-top:5px;}
.homeText{color:#ef4444;}
.awayText{color:#3b82f6;}
.tieText{color:#eab308;}
.sectionTitle{font-size:12px;color:#94a3b8;font-weight:900;margin-bottom:12px;text-transform:uppercase;}
.balls{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}
.ball{width:37px;height:37px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;border:2px solid;}
.ball.home{color:#ef4444;border-color:#ef4444;background:rgba(239,68,68,.13);}
.ball.away{color:#3b82f6;border-color:#3b82f6;background:rgba(59,130,246,.13);}
.ball.tie{color:#eab308;border-color:#eab308;background:rgba(234,179,8,.13);}
.analysis{display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin-top:14px;}
.signalBox{border-radius:18px;padding:22px;background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(15,23,42,.85));border:1px solid rgba(16,185,129,.2);}
.signal{font-size:25px;font-weight:950;margin:5px 0 10px;}
.muted{color:#64748b;font-size:11px;}
.analysisGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
.mini{background:rgba(2,6,23,.55);border:1px solid rgba(255,255,255,.05);padding:13px;border-radius:14px;}
.miniValue{font-size:20px;font-weight:900;margin-top:5px;}
.chartGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;}
canvas{max-height:300px;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th{color:#64748b;font-size:9px;text-transform:uppercase;padding:10px 6px;text-align:left;}
td{padding:9px 6px;border-top:1px solid rgba(255,255,255,.04);}
.status{font-size:10px;color:#64748b;margin-top:5px;}
.badge{display:inline-block;padding:5px 9px;border-radius:999px;background:rgba(16,185,129,.1);color:#10b981;font-size:10px;font-weight:800;}
.warning{margin-top:12px;padding:11px;border-radius:12px;background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.12);color:#a8a29e;font-size:10px;line-height:1.5;}
@media(max-width:800px){.grid{grid-template-columns:repeat(2,1fr);}.analysis{grid-template-columns:1fr;}.chartGrid{grid-template-columns:1fr;}}
</style>
</head>
<body>
<div class="container">
  <div class="glass header">
    <div>
      <div class="logo">VANDER <span>STUDIO AI</span></div>
      <div class="status" id="status">${botStatus}</div>
    </div>
    <div class="live">● LIVE</div>
  </div>

  <div class="grid">
    <div class="card"><div class="label">Rodadas</div><div class="number" id="total">${total}/400</div></div>
    <div class="card"><div class="label" style="color:#ef4444">HOME</div><div class="number homeText">${stats.HOME} <span style="font-size:14px;color:#64748b">${homePct}%</span></div></div>
    <div class="card"><div class="label" style="color:#3b82f6">AWAY</div><div class="number awayText">${stats.AWAY} <span style="font-size:14px;color:#64748b">${awayPct}%</span></div></div>
    <div class="card"><div class="label" style="color:#eab308">TIE</div><div class="number tieText">${stats.TIE} <span style="font-size:14px;color:#64748b">${tiePct}%</span></div></div>
  </div>

  <div class="glass">
    <div class="sectionTitle">PLACAR GRANDE • 400 • ${botStatus}</div>
    <div class="balls">${bolas || 'Aguardando...'}</div>
  </div>

  <div class="analysis">
    <div class="glass">
      <div class="sectionTitle">ANÁLISE ESTATÍSTICA</div>
      <div id="analysisBox">Carregando análise...</div>
    </div>
    <div class="glass">
      <div class="sectionTitle">SEQUÊNCIA ATUAL</div>
      <div class="mini"><div class="label">Streak</div><div class="miniValue">${streak.type || '-'} x${streak.length}</div></div>
      <div class="mini" style="margin-top:10px"><div class="label">Últimos 5</div><div class="miniValue" style="font-size:14px">${history.slice(0,5).map(h=>h.winner).join(' > ') || '-'}</div></div>
      <div class="warning">Análise baseada somente no histórico. Sequências passadas não garantem o próximo resultado. Use com responsabilidade.</div>
    </div>
  </div>

  <div class="chartGrid">
    <div class="glass"><div class="sectionTitle">DISTRIBUIÇÃO 400</div><canvas id="chartDist"></canvas></div>
    <div class="glass"><div class="sectionTitle">HISTÓRICO 50</div><canvas id="chartHist"></canvas></div>
  </div>

  <div class="glass" style="margin-top:14px">
    <div class="sectionTitle">HISTÓRICO • 400 • ANOTANDO CORES E PLACAR</div>
    <table><thead><tr><th>#</th><th>Resultado</th><th>Placar</th><th>Hora</th></tr></thead><tbody>${linhas || '<tr><td colspan=4 style="text-align:center;padding:20px;color:#64748b">Conectando...</td></tr>'}</tbody></table>
  </div>
</div>

<script>
async function loadAnalysis(){
  try{
    const res = await fetch('/api/analysis');
    const data = await res.json();
    const a = data.analysis;
    const box = document.getElementById('analysisBox');
    if(!a.ready){ box.innerHTML = '<div class="muted">'+a.message+'</div>'; return; }
    box.innerHTML = '<div class="signalBox"><div class="label">Sinal</div><div class="signal">'+a.signal+'</div><div class="muted">Gap: '+a.gap+' • Amostra: '+a.historicalSample+'</div><div style="margin-top:12px" class="analysisGrid"><div class="mini"><div class="label">HOME Score</div><div class="miniValue">'+a.scores.HOME.toFixed(1)+'</div></div><div class="mini"><div class="label">AWAY Score</div><div class="miniValue">'+a.scores.AWAY.toFixed(1)+'</div></div><div class="mini"><div class="label">Similar 3</div><div class="miniValue">'+a.similar.three.occurrences+'x</div><div class="muted">HOME:'+(a.similar.three.following.HOME||0)+' AWAY:'+(a.similar.three.following.AWAY||0)+'</div></div><div class="mini"><div class="label">Similar 4</div><div class="miniValue">'+a.similar.four.occurrences+'x</div></div></div><div class="badge" style="margin-top:12px">Últimos 10: HOME '+a.recent.c10.HOME+' AWAY '+a.recent.c10.AWAY+' TIE '+a.recent.c10.TIE+'</div><div class="warning">'+a.disclaimer+'</div></div>';

    const ctx1 = document.getElementById('chartDist');
    if(ctx1){ new Chart(ctx1,{type:'doughnut',data:{labels:['HOME','AWAY','TIE'],datasets:[{data:[${stats.HOME},${stats.AWAY},${stats.TIE}],backgroundColor:['#ef4444','#3b82f6','#eab308']}]},options:{plugins:{legend:{labels:{color:'#94a3b8'}}}}}); }

    const seq = ${JSON.stringify(history.slice(0,50).map(h=>h.winner).reverse())};
    const ctx2 = document.getElementById('chartHist');
    if(ctx2 && seq.length){ new Chart(ctx2,{type:'bar',data:{labels:seq.map((_,i)=>i+1),datasets:[{label:'Resultado',data:seq.map(s=>s==='HOME'?1:s==='AWAY'?2:0),backgroundColor:seq.map(s=>s==='HOME'?'#ef4444':s==='AWAY'?'#3b82f6':'#eab308')}]},options:{plugins:{legend:{display:false}},scales:{y:{ticks:{color:'#64748b'}},x:{ticks:{color:'#64748b'}}}}}); }

  }catch(e){ document.getElementById('analysisBox').innerHTML = '<div class="muted">Erro análise: '+e.message+'</div>'; }
}
loadAnalysis();
setInterval(()=>location.reload(),15000);
</script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/rounds') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: history.length, botStatus, data: history }));
    return;
  }
  if (url.pathname === '/api/stats') {
    res.writeH
