import express from 'express';
import cors from 'cors';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
let SUPABASE_AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN || 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwNDI5NTAwLCJpYXQiOjE3OTA0MjU5MDAsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.TJef0QdVhjkcaEiEKci95bARRFPUlkqwlWKQfsYNuqkjK5ge4FGzjpCJx3RDv3JOxhyXGvB0-RcA8xAU__b6EA';
const SITE_USER = process.env.SITE_USER || 'santarosavander@gmail.com';
const SITE_PASS = process.env.SITE_PASS || '131619jV*';

const app = express();
app.use(cors());
app.use(express.json());

let history = [];
let stats = { HOME:0, AWAY:0, TIE:0 };
let botStatus = 'Iniciando...';
let lastUpdate = null;
let lastError = '';

function loadHistory(){
  try{
    if(fs.existsSync('./token.json')){
      const tj = JSON.parse(fs.readFileSync('./token.json','utf8'));
      if(tj.token) SUPABASE_AUTH_TOKEN = tj.token;
    }
    if(fs.existsSync('./history.json')){
      const d=JSON.parse(fs.readFileSync('./history.json','utf8'));
      history=d; stats={HOME:0,AWAY:0,TIE:0};
      d.forEach(h=>{ if(stats[h.winner]!==undefined) stats[h.winner]++; });
    }
  }catch(e){}
}
function saveHistory(){ try{ fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,5000))); }catch(e){} }
function addResult(winner, row){
  if(history[0]?.round_id && row?.id && history[0].round_id===row.id) return false;
  const entry={ round_id: row.id, round: row.round_number || history.length+1, winner: winner.toUpperCase(), timestamp: new Date().toISOString(), time: new Date().toLocaleTimeString('pt-BR'), created_at: row.created_at };
  history.unshift(entry); if(history.length>5000) history.pop(); stats[entry.winner]=(stats[entry.winner]||0)+1; lastUpdate=entry.timestamp; saveHistory(); console.log('[REAL] '+entry.winner); return true;
}

async function fetchReal(){
  try{
    if(!SUPABASE_AUTH_TOKEN){ botStatus='SEM TOKEN - Clique no botão abaixo para logar'; return false; }
    let headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
    let res=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?order=created_at.desc&limit=200',{headers});
    if(!res.ok){
      lastError=await res.text(); botStatus='Erro Supabase: '+res.status+' - Token expirado, clique no botão RENOVAR abaixo';
      console.log('[ERRO] '+res.status+' '+lastError.slice(0,200));
      return false;
    }
    const data=await res.json();
    if(!Array.isArray(data)||data.length===0){ botStatus='Conectado mas sem dados'; return false; }
    let newCount=0; for(let i=data.length-1;i>=0;i--){ const row=data[i]; const w=(row.winner||'').toString().toUpperCase(); if(!['HOME','AWAY','TIE'].includes(w)) continue; if(!history.find(h=>h.round_id===row.id)){ if(addResult(w,row)) newCount++; } }
    botStatus='✅ REAL - '+history.length+' rodadas'+(newCount?(' - '+newCount+' novas'):'');
    return true;
  }catch(e){ lastError=e.message; botStatus='Erro: '+e.message; return false; }
}

async function start(){ loadHistory(); await fetchReal(); setInterval(fetchReal, 8000); }

app.post('/api/set-token', (req,res)=>{
  const t=req.body.token; if(!t||t.length<100) return res.json({success:false});
  SUPABASE_AUTH_TOKEN=t; try{ fs.writeFileSync('./token.json', JSON.stringify({token:t, time:new Date().toISOString()})); }catch(e){}
  botStatus='Token atualizado! Coletando...'; fetchReal();
  res.json({success:true});
});

app.get('/', (req,res)=>{
  const total=history.length;
  const homePct=total?((stats.HOME/total)*100).toFixed(1):0;
  const awayPct=total?((stats.AWAY/total)*100).toFixed(1):0;
  const tiePct=total?((stats.TIE/total)*100).toFixed(1):0;
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEU PLACAR REAL</title><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#05080f;color:#e2e8f0;font-family:Inter,Arial;padding:12px}.header{background:linear-gradient(135deg,#111827,#1f2937);border:1px solid #2d3748;padding:16px;border-radius:16px;margin-bottom:12px}.btn{background:#10b981;color:#000;border:0;padding:12px 20px;border-radius:10px;font-weight:800;cursor:pointer;width:100%;margin:10px 0}.btn2{background:#3b82f6;color:#fff}.card{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:14px;text-align:center}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.HOME{color:#ef4444}.AWAY{color:#3b82f6}.TIE{color:#eab308}.placar{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:14px;margin-bottom:12px}.bolas{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.bola{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid}.bola.HOME{background:#ef44441f;color:#ef4444;border-color:#ef4444}.bola.AWAY{background:#3b82f61f;color:#3b82f6;border-color:#3b82f6}.bola.TIE{background:#eab3081f;color:#eab308;border-color:#eab308}.chart-box{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:14px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{font-size:10px;color:#64748b;text-transform:uppercase;padding:8px;text-align:left;border-bottom:1px solid #1f2937}td{padding:8px;font-size:13px;border-bottom:1px solid #1f2937}</style></head><body>
<div class="header"><h1>🎰 MEU PLACAR - JOKERIA REAL</h1><p style="color:#10b981;font-size:13px;margin-top:6px">\${botStatus}</p><p style="color:#64748b;font-size:11px">Erro: \${lastError.slice(0,100)}</p>
<div id="loginBox" style="background:#0a0e1a;border:1px solid #1f2937;padding:12px;border-radius:10px;margin-top:12px">
<p style="font-size:12px;color:#eab308;margin-bottom:8px">⚠️ Token expirado (401) - Clique para renovar automático:</p>
<button class="btn" onclick="renovar()">🔄 RENOVAR TOKEN AUTOMÁTICO (1 clique)</button>
<p style="font-size:11px;color:#64748b;margin-top:8px">Isso usa seu login ${SITE_USER} para pegar token novo direto no navegador, sem ir no Render</p>
<div id="msg" style="margin-top:8px;font-size:12px;color:#94a3b8"></div>
</div>
</div>
<div class="grid"><div class="card"><h3 style="font-size:11px;color:#94a3b8">TOTAL REAL</h3><div style="font-size:26px;font-weight:800">\${total}</div></div><div class="card"><h3 class="HOME">HOME</h3><div style="font-size:22px;font-weight:800" class="HOME">\${stats.HOME||0} \${homePct}%</div></div><div class="card"><h3 class="AWAY">AWAY</h3><div style="font-size:22px;font-weight:800" class="AWAY">\${stats.AWAY||0} \${awayPct}%</div></div><div class="card"><h3 class="TIE">TIE</h3><div style="font-size:22px;font-weight:800" class="TIE">\${stats.TIE||0} \${tiePct}%</div></div></div>
<div class="placar"><h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px">PLACAR GRANDE - Últimas 100</h3><div class="bolas">\${history.slice(0,100).map(h=>\`<div class="bola \${h.winner}">\${h.winner[0]}</div>\`).join('')||'Aguardando dados...'}</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="chart-box"><canvas id="d" height="180"></canvas></div><div class="chart-box"><canvas id="t" height="180"></canvas></div></div>
<div class="placar"><table><thead><tr><th>#</th><th>Resultado</th><th>Hora</th></tr></thead><tbody>\${history.slice(0,50).map((h,i)=>\`<tr><td>#\${history.length-i}</td><td><span style="background:\${h.winner==='HOME'?'#ef44441f':h.winner==='AWAY'?'#3b82f61f':'#eab3081f'};color:\${h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308'};padding:3px 8px;border-radius:10px;font-weight:700">\${h.winner}</span></td><td>\${h.time}</td></tr>\`).join('')}</tbody></table></div>
<script>
async function renovar(){
  document.getElementById('msg').innerText='Renovando...';
  try{
    const res=await fetch('https://ulzvxigcdcwbyfnpewjc.supabase.co/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':'${SUPABASE_ANON_KEY}','Content-Type':'application/json'},body:JSON.stringify({email:'${SITE_USER}',password:'${SITE_PASS}'})});
    const data=await res.json();
    if(!data.access_token){ document.getElementById('msg').innerText='Erro login: '+JSON.stringify(data).slice(0,200); return; }
    const r2=await fetch('/api/set-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:data.access_token})});
    const j2=await r2.json();
    if(j2.success){ document.getElementById('msg').innerText='✅ Token renovado! Recarregando...'; setTimeout(()=>location.reload(),1500); }
    else document.getElementById('msg').innerText='Erro ao salvar';
  }catch(e){ document.getElementById('msg').innerText='Erro: '+e.message; }
}
fetch('/api/stats').then(r=>r.json()).then(d=>{ new Chart(document.getElementById('d'),{type:'doughnut',data:{labels:['HOME','AWAY','TIE'],datasets:[{data:[d.stats.HOME||0,d.stats.AWAY||0,d.stats.TIE||0],backgroundColor:['#ef4444','#3b82f6','#eab308']}]}}); });
fetch('/api/rounds').then(r=>r.json()).then(res=>{ const last50=res.data.slice(0,50).reverse(); new Chart(document.getElementById('t'),{type:'bar',data:{labels:last50.map((_,i)=>i+1),datasets:[{data:last50.map(h=>h.winner==='HOME'?1:h.winner==='AWAY'?2:3),backgroundColor:last50.map(h=>h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308')}]},options:{plugins:{legend:{display:false}},scales:{y:{display:false},x:{display:false}}}}); });
setTimeout(()=>location.reload(),20000);
</script>
</body></html>`);
});
app.get('/api/rounds',(req,res)=>res.json({success:true,count:history.length,lastUpdate,botStatus,data:history, error:lastError}));
app.get('/api/stats',(req,res)=>res.json({success:true,stats,total:history.length,lastUpdate,botStatus,error:lastError}));
const PORT=process.env.PORT||10000;
app.listen(PORT,()=>{ console.log('🚀 REAL na porta '+PORT); start(); });
