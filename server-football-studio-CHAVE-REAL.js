import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
const SUPABASE_AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN || 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwMTAwMzg2LCJpYXQiOjE3OTAwOTY3ODYsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.j3f0q5UlYTzETY2-PL7y8L-4_r2eBSC4Cr85ea0KU-hTq50tZ3p5HCgZ-QZElg1y-p5WC-y6RAc6z7X6MkXeaQ';
const SITE_URL = process.env.SITE_URL || 'https://jokeria.app/app';
const SITE_USER = process.env.SITE_USER || 'santarosavander@gmail.com';
const SITE_PASS = process.env.SITE_PASS || '131619jV*';

let history = [];
let stats = { HOME: 0, AWAY: 0, TIE: 0 };
let lastUpdate = null;
let botStatus = 'Iniciando...';

function loadHistory() {
  try {
    if (fs.existsSync('./history.json')) {
      const data = JSON.parse(fs.readFileSync('./history.json', 'utf8'));
      history = data;
      stats = { HOME: 0, AWAY: 0, TIE: 0 };
      data.forEach(h => { if (stats[h.winner] !== undefined) stats[h.winner]++; });
      console.log(`[LOAD] ${history.length} rodadas`);
    }
  } catch(e) {}
}
function saveHistory() {
  try { fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,5000))); } catch(e) {}
}
function addResult(winner, source='supabase', roundData=null) {
  if (history.length > 0 && history[0].round_id && roundData && roundData.id && history[0].round_id === roundData.id) return;
  const entry = {
    round: roundData?.round_number || history.length + 1,
    round_id: roundData?.id || null,
    winner,
    source,
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString('pt-BR'),
    full_data: roundData
  };
  history.unshift(entry);
  if (history.length > 5000) history.pop();
  stats[winner] = (stats[winner]||0)+1;
  lastUpdate = entry.timestamp;
  saveHistory();
  console.log(`[COLETADO ${source.toUpperCase()}] #${entry.round} - ${winner}`);
}

async function fetchFromSupabase() {
  try {
    const headersAuth = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    };
    let res = await fetch(`${SUPABASE_URL}/rest/v1/football_studio_rounds?order=created_at.desc&limit=100`, { headers: headersAuth });
    if (!res.ok) {
      const headersAnon = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      };
      res = await fetch(`${SUPABASE_URL}/rest/v1/football_studio_rounds?order=created_at.desc&limit=100`, { headers: headersAnon });
      if (!res.ok) {
        console.log(`[SUPABASE FALHOU] ${res.status} - tentando scraping`);
        return false;
      }
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return false;
    let newCount = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      const exists = history.find(h => h.round_id === row.id);
      if (!exists) {
        addResult(row.winner || row.result || 'HOME', 'supabase', row);
        newCount++;
      }
    }
    if (newCount > 0) {
      botStatus = `Coletando do Supabase - ${history.length} rodadas`;
      console.log(`[SUPABASE] ${newCount} novas`);
    }
    return true;
  } catch(e) {
    console.log('[SUPABASE ERRO]', e.message);
    return false;
  }
}

async function startScraper() {
  loadHistory();
  botStatus = 'Iniciando coleta...';
  const supabaseInterval = setInterval(async () => {
    await fetchFromSupabase();
  }, 10000);
  await fetchFromSupabase();
  // Se supabase falhar, inicia simulação pra não ficar parado
  setTimeout(() => {
    if (history.length === 0) {
      botStatus = 'Supabase sem dados, modo simulação realista ativo';
      setInterval(() => {
        const r = Math.random();
        const w = r < 0.44 ? 'HOME' : r < 0.88 ? 'AWAY' : 'TIE';
        addResult(w, 'simulacao');
      }, 12000);
    }
  }, 30000);
}

app.get('/', (req, res) => {
  const total = history.length;
  const homePct = total ? ((stats.HOME/total)*100).toFixed(1) : 0;
  const awayPct = total ? ((stats.AWAY/total)*100).toFixed(1) : 0;
  const tiePct = total ? ((stats.TIE/total)*100).toFixed(1) : 0;
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jokeria Cloud - Football Studio</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0e1a;color:#e2e8f0;font-family:Inter,system-ui;padding:20px}
.header{display:flex;justify-content:space-between;align-items:center;background:#111827;border:1px solid #1f2937;padding:16px;border-radius:12px;margin-bottom:20px}
.live{display:flex;align-items:center;gap:8px}.dot{width:10px;height:10px;background:#10b981;border-radius:50%;animation:pulse 1.5s infinite}@keyframes pulse{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px}
.card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px}
.card h3{font-size:14px;color:#94a3b8;margin-bottom:8px}.card .value{font-size:28px;font-weight:700}
.home{color:#ef4444}.away{color:#3b82f6}.tie{color:#eab308}
.chart-box{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:20px}
table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px;color:#94a3b8;font-size:12px;text-transform:uppercase;border-bottom:1px solid #1f2937}td{padding:12px;border-bottom:1px solid #1f2937}tr:hover{background:#1f2937}
.badge{padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600}.badge.HOME{background:#ef44441a;color:#ef4444}.badge.AWAY{background:#3b82f61a;color:#3b82f6}.badge.TIE{background:#eab3081a;color:#eab308}
</style>
</head><body>
<div class="header">
<div><h1>🎰 Jokeria Cloud - Football Studio</h1><p style="color:#94a3b8;font-size:14px;margin-top:4px">${botStatus}</p></div>
<div class="live"><div class="dot"></div><span style="color:#10b981;font-weight:600">ONLINE</span></div>
</div>
<div class="grid">
<div class="card"><h3>TOTAL COLETADO</h3><div class="value">${total}</div><p style="color:#64748b;font-size:12px;margin-top:4px">Última: ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString('pt-BR') : 'Nunca'}</p></div>
<div class="card"><h3 class="home">HOME (Casa)</h3><div class="value home">${stats.HOME||0} <span style="font-size:16px">(${homePct}%)</span></div></div>
<div class="card"><h3 class="away">AWAY (Fora)</h3><div class="value away">${stats.AWAY||0} <span style="font-size:16px">(${awayPct}%)</span></div></div>
<div class="card"><h3 class="tie">TIE (Empate)</h3><div class="value tie">${stats.TIE||0} <span style="font-size:16px">(${tiePct}%)</span></div></div>
</div>
<div style="display:grid;grid-template-columns:2fr 1fr;gap:16px">
<div class="chart-box"><h3 style="margin-bottom:16px">Distribuição</h3><canvas id="distChart" height="200"></canvas></div>
<div class="chart-box"><h3 style="margin-bottom:16px">Timeline 50 últimas</h3><canvas id="timelineChart" height="200"></canvas></div>
</div>
<div class="chart-box"><h3>Histórico (50 últimas)</h3>
<table><thead><tr><th>#</th><th>Resultado</th><th>Origem</th><th>Horário</th></tr></thead>
<tbody>
${history.slice(0,50).map(h=>`<tr><td>#${h.round}</td><td><span class="badge ${h.winner}">${h.winner}</span></td><td style="color:#64748b;font-size:12px">${h.source}</td><td>${h.time}</td></tr>`).join('')}
</tbody></table>
</div>
<script>
fetch('/api/stats').then(r=>r.json()).then(d=>{
  const ctx1 = document.getElementById('distChart').getContext('2d');
  new Chart(ctx1, {
    type: 'doughnut',
    data: { labels: ['HOME','AWAY','TIE'], datasets: [{ data: [d.stats.HOME||0, d.stats.AWAY||0, d.stats.TIE||0], backgroundColor: ['#ef4444','#3b82f6','#eab308'], borderWidth: 0 }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }
  });
});
fetch('/api/rounds').then(r=>r.json()).then(res=>{
  const last50 = res.data.slice(0,50).reverse();
  const ctx2 = document.getElementById('timelineChart').getContext('2d');
  new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: last50.map((_,i)=>i+1),
      datasets: [{ data: last50.map(h=>h.winner==='HOME'?1:h.winner==='AWAY'?2:3), backgroundColor: last50.map(h=>h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308') }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { display: false } } }
  });
});
setTimeout(()=>location.reload(), 30000);
</script>
</body></html>`);
});

app.get('/api/rounds', (req,res)=>res.json({ success: true, count: history.length, lastUpdate, data: history }));
app.get('/api/stats', (req,res)=>res.json({ success: true, stats, total: history.length, lastUpdate, botStatus }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Jokeria Cloud rodando na porta ${PORT}`);
  startScraper();
});
