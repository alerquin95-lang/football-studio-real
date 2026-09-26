import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
let SUPABASE_AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN || 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwMTAwMzg2LCJpYXQiOjE3OTAwOTY3ODYsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.j3f0q5UlYTzETY2-PL7y8L-4_r2eBSC4Cr85ea0KU-hTq50tZ3p5HCgZ-QZElg1y-p5WC-y6RAc6z7X6MkXeaQ';
const SITE_USER = process.env.SITE_USER || 'santarosavander@gmail.com';
const SITE_PASS = process.env.SITE_PASS || '131619jV*';

let history = [];
let stats = { HOME:0, AWAY:0, TIE:0 };
let botStatus = 'Iniciando coleta REAL...';
let lastUpdate = null;
let lastError = '';

function loadHistory(){ try{ if(fs.existsSync('./history.json')){ const d=JSON.parse(fs.readFileSync('./history.json','utf8')); history=d; stats={HOME:0,AWAY:0,TIE:0}; d.forEach(h=>{ if(stats[h.winner]!==undefined) stats[h.winner]++; }); console.log('[LOAD] '+history.length+' rodadas'); } }catch(e){} }
function saveHistory(){ try{ fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,5000))); }catch(e){} }
function addResult(winner, source, row){
  if(history[0]?.round_id && row?.id && history[0].round_id===row.id) return false;
  const entry={ round_id: row?.id || null, round: row?.round_number || history.length+1, winner: winner.toUpperCase(), source, timestamp: new Date().toISOString(), time: new Date().toLocaleTimeString('pt-BR'), created_at: row?.created_at||null };
  history.unshift(entry); if(history.length>5000) history.pop(); stats[entry.winner]=(stats[entry.winner]||0)+1; lastUpdate=entry.timestamp; saveHistory(); console.log('[REAL] #'+entry.round+' - '+entry.winner); return true;
}
async function refreshToken(){
  try{
    const res=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{ method:'POST', headers:{'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'}, body: JSON.stringify({email:SITE_USER,password:SITE_PASS}) });
    const data=await res.json(); if(data.access_token){ SUPABASE_AUTH_TOKEN=data.access_token; console.log('[AUTH] Token renovado'); return true; }
    return false;
  }catch(e){ return false; }
}
async function fetchReal(){
  try{
    let headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
    let res=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?order=created_at.desc&limit=200',{headers});
    if(!res.ok){
      lastError=res.status+' - '+(await res.text()).slice(0,100);
      if(res.status===401){ if(await refreshToken()){ headers.Authorization='Bearer '+SUPABASE_AUTH_TOKEN; res=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?order=created_at.desc&limit=200',{headers}); } }
      if(!res.ok){
        headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_ANON_KEY,'Content-Type':'application/json'};
        res=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?order=created_at.desc&limit=200',{headers});
        if(!res.ok){ botStatus='Erro Supabase: '+res.status; return false; }
      }
    }
    const data=await res.json(); if(!Array.isArray(data)||data.length===0){ botStatus='Supabase conectado mas sem dados'; return false; }
    let newCount=0; for(let i=data.length-1;i>=0;i--){ const row=data[i]; const w=(row.winner||row.result||'').toString().toUpperCase(); if(!['HOME','AWAY','TIE'].includes(w)) continue; if(!history.find(h=>h.round_id===row.id)){ if(addResult(w,'jokeria REAL',row)) newCount++; } }
    if(newCount>0){ botStatus='✅ COLETANDO REAL DO JOKERIA - '+history.length+' rodadas'; } else if(history.length>0){ botStatus='✅ REAL JOKERIA - '+history.length+' rodadas - Aguardando novas'; }
    return true;
  }catch(e){ lastError=e.message; botStatus='Erro: '+e.message; return false; }
}
async function start(){ loadHistory(); await fetchReal(); setInterval(fetchReal, 8000); }

app.get('/', (req,res)=>{
  const total=history.length;
  const homePct=total?((stats.HOME/total)*100).toFixed(1):0;
  const awayPct=total?((stats.AWAY/total)*100).toFixed(1):0;
  const tiePct=total?((stats.TIE/total)*100).toFixed(1):0;
  let streak={type:history[0]?.winner||'-',count:0}; for(let h of history){ if(h.winner===streak.type) streak.count++; else break; }
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEU PLACAR - JOKERIA REAL</title><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#05080f;color:#e2e8f0;font-family:Inter,Arial;padding:12px}.header{background:linear-gradient(135deg,#111827,#1f2937);border:1px solid #2d3748;padding:16px;border-radius:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}.dot{width:12px;height:12px;background:#10b981;border-radius:50%;animation:pulse 1s infinite}@keyframes pulse{0%{box-shadow:0 0 0 0 #10b981}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.card{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:14px;text-align:center}.card h3{font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px}.card .val{font-size:26px;font-weight:800}.HOME{color:#ef4444}.AWAY{color:#3b82f6}.TIE{color:#eab308}.placar{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:14px;margin-bottom:12px}.bolas{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.bola{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid}.bola.HOME{background:#ef44441f;color:#ef4444;border-color:#ef4444}.bola.AWAY{background:#3b82f61f;color:#3b82f6;border-color:#3b82f6}.bola.TIE{background:#eab3081f;color:#eab308;border-color:#eab308}.chart-box{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:14px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{font-size:10px;color:#64748b;text-transform:uppercase;padding:8px;text-align:left;border-bottom:1px solid #1f2937}td{padding:8px;font-size:13px;border-bottom:1px solid #1f2937}</style></head><body>
<div class="header"><div><h1 style="font-size:20px">🎰 MEU PLACAR - JOKERIA REAL</h1><p style="color:#10b981;font-size:13px;margin-top:4px">${botStatus}</p><p style="color:#64748b;font-size:11px">Fonte: jokeria.app Supabase - 24h online</p></div><div style="text-align:center"><div class="dot" style="margin:0 auto 6px"></div><span style="color:#10b981;font-weight:700;font-size:12px">LIVE REAL</span><div style="font-size:10px;color:#94a3b8;margin-top:4px">Streak: ${streak.type} x${streak.count}</div></div></div>
<div class="grid"><div class="card"><h3>Total Real</h3><div class="val">${total}</div><div style="font-size:11px;color:#64748b">do Joker</div></div><div class="card"><h3 class="HOME">Home</h3><div class="val HOME">${stats.HOME||0}<span style="font-size:14px"> ${homePct}%</span></div></div><div class="card"><h3 class="AWAY">Away</h3><div class="val AWAY">${stats.AWAY||0}<span style="font-size:14px"> ${awayPct}%</span></div></div><div class="card"><h3 class="TIE">Tie</h3><div class="val TIE">${stats.TIE||0}<span style="font-size:14px"> ${tiePct}%</span></div></div></div>
<div class="placar"><h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px;text-transform:uppercase">PLACAR GRANDE - Ultimas 100 (igual do Joker)</h3><div class="bolas">${history.slice(0,100).map(h=>`<div class="bola ${h.winner}" title="${h.time} - ${h.winner}">${h.winner==='HOME'?'H':h.winner==='AWAY'?'A':'T'}</div>`).join('')||'<span style="color:#64748b">Aguardando dados reais...</span>'}</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="chart-box"><h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px">DISTRIBUICAO REAL</h3><canvas id="d" height="180"></canvas></div><div class="chart-box"><h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px">TIMELINE 50</h3><canvas id="t" height="180"></canvas></div></div>
<div class="placar"><h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px">HISTORICO REAL (50 ultimas do banco do Joker)</h3><table><thead><tr><th>#</th><th>Resultado</th><th>Hora</th><th>Fonte</th></tr></thead><tbody>${history.slice(0,50).map((h,i)=>`<tr><td>#${history.length-i}</td><td><span style="background:${h.winner==='HOME'?'#ef44441f':h.winner==='AWAY'?'#3b82f61f':'#eab3081f'};color:${h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308'};padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700">${h.winner}</span></td><td style="color:#94a3b8">${h.time}</td><td style="color:#10b981;font-size:11px">REAL</td></tr>`).join('')||'<tr><td colspan=4 style="text-align:center;color:#64748b;padding:20px">Conectando no banco REAL do jokeria.app...<br>Coloque as 5 Environment Variables no Render</td></tr>'}</tbody></table></div>
<script>
fetch('/api/stats').then(r=>r.json()).then(d=>{ new Chart(document.getElementById('d'),{type:'doughnut',data:{labels:['HOME','AWAY','TIE'],datasets:[{data:[d.stats.HOME||0,d.stats.AWAY||0,d.stats.TIE||0],backgroundColor:['#ef4444','#3b82f6','#eab308'],borderWidth:0}]},options:{plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',font:{size:11}}}}}}); });
fetch('/api/rounds').then(r=>r.json()).then(res=>{ const last50=res.data.slice(0,50).reverse(); new Chart(document.getElementById('t'),{type:'bar',data:{labels:last50.map((_,i)=>i+1),datasets:[{data:last50.map(h=>h.winner==='HOME'?1:h.winner==='AWAY'?2:3),backgroundColor:last50.map(h=>h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308')}]},options:{plugins:{legend:{display:false}},scales:{y:{display:false},x:{display:false}}}}); });
setTimeout(()=>location.reload(),12000);
</script>
</body></html>`);
});
app.get('/api/rounds',(req,res)=>res.json({success:true,count:history.length,lastUpdate,botStatus,data:history}));
app.get('/api/stats',(req,res)=>res.json({success:true,stats,total:history.length,lastUpdate,botStatus,error:lastError}));
app.get('/api/latest',(req,res)=>res.json({success:true,data:history[0]||null}));
const PORT=process.env.PORT||10000;
app.listen(PORT,()=>{ console.log('🚀 MEU PLACAR REAL na porta '+PORT); start(); });

