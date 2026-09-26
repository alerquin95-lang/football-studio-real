import express from 'express';
import cors from 'cors';
import fs from 'fs';

const SUPABASE_URL = 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
let SUPABASE_AUTH_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwNDI5NTAwLCJpYXQiOjE3OTA0MjU5MDAsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.TJef0QdVhjkcaEiEKci95bARRFPUlkqwlWKQfsYNuqkjK5ge4FGzjpCJx3RDv3JOxhyXGvB0-RcA8xAU__b6EA';
const SITE_USER = 'santarosavander@gmail.com';
const SITE_PASS = '131619jV*';

const app = express();
app.use(cors());
app.use(express.json());

let history = [];
let stats = { HOME:0, AWAY:0, TIE:0 };
let botStatus = 'Conectando ao Joker...';
let lastError = '';

function normalizeWinner(raw){
  const s = (raw||'').toString().trim().toUpperCase();
  if(['HOME','H','CASA','1','RED'].includes(s)) return 'HOME';
  if(['AWAY','A','FORA','2','BLUE'].includes(s)) return 'AWAY';
  if(['TIE','T','EMPATE','DRAW','X','0'].includes(s)) return 'TIE';
  if(s.includes('HOME')) return 'HOME';
  if(s.includes('AWAY')) return 'AWAY';
  if(s.includes('TIE')) return 'TIE';
  return null;
}

function loadHistory(){
  try{
    if(fs.existsSync('./token.json')){
      const tj=JSON.parse(fs.readFileSync('./token.json','utf8'));
      if(tj.token) SUPABASE_AUTH_TOKEN = tj.token;
    }
    if(fs.existsSync('./history.json')){
      const d=JSON.parse(fs.readFileSync('./history.json','utf8'));
      history=d.slice(0,200); stats={HOME:0,AWAY:0,TIE:0};
      d.forEach(h=>{ if(stats[h.winner]!==undefined) stats[h.winner]++; });
    }
  }catch(e){}
}
function saveHistory(){ try{ fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,200))); }catch(e){} }

function addResult(w,row){
  const norm = normalizeWinner(w);
  if(!norm) return false;
  if(history[0]?.round_id && row?.id && history[0].round_id===row.id) return false;
  const e={ round_id: row.id, winner: norm, time: new Date().toLocaleTimeString('pt-BR') };
  history.unshift(e); if(history.length>200) history.pop(); stats[norm]=(stats[norm]||0)+1; saveHistory(); return true;
}

async function refreshTokenAuto(){
  try{
    const res=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body: JSON.stringify({email:SITE_USER,password:SITE_PASS})
    });
    const data=await res.json();
    if(data.access_token){
      SUPABASE_AUTH_TOKEN=data.access_token;
      fs.writeFileSync('./token.json', JSON.stringify({token:data.access_token}));
      return true;
    }
    return false;
  }catch(e){ return false; }
}

async function fetchReal(){
  try{
    let headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
    let res=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=200',{headers});
    if(!res.ok && res.status===401){
      await refreshTokenAuto();
      headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
      res=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=200',{headers});
    }
    if(!res.ok){ lastError=await res.text(); botStatus='Erro: '+res.status; return false; }
    const data=await res.json();
    if(!Array.isArray(data)||data.length===0){ botStatus='Aguardando dados...'; return false; }
    let newCount=0;
    for(let j=data.length-1;j>=0;j--){
      const row=data[j];
      const raw = row.winner || row.result || row.outcome || '';
      if(!history.find(h=>h.round_id===row.id)){ if(addResult(raw,row)) newCount++; }
    }
    botStatus='✅ LIVE - Vander Placar - '+history.length+' resultados'+(newCount?(' +'+newCount):'');
    return true;
  }catch(e){ lastError=e.message; botStatus='Erro: '+e.message; return false; }
}

async function start(){ loadHistory(); await fetchReal(); setInterval(fetchReal, 5000); setInterval(refreshTokenAuto, 1000*60*30); }

app.get('/api/rounds',(req,res)=>res.json({success:true,count:history.length,botStatus,data:history,error:lastError}));
app.get('/api/stats',(req,res)=>res.json({success:true,stats,total:history.length,botStatus,error:lastError}));
app.get('/api/clear',(req,res)=>{ try{ fs.unlinkSync('./history.json'); }catch(e){} history=[]; stats={HOME:0,AWAY:0,TIE:0}; fetchReal(); res.json({success:true}); });

app.get('/',(req,res)=>{
  const total=history.length;
  const homePct=total?((stats.HOME/total)*100).toFixed(1):0;
  const awayPct=total?((stats.AWAY/total)*100).toFixed(1):0;
  const tiePct=total?((stats.TIE/total)*100).toFixed(1):0;
  const bolas = history.map(h=>{
    const cls = h.winner==='HOME'?'home':h.winner==='AWAY'?'away':'tie';
    const letter = h.winner==='HOME'?'H':h.winner==='AWAY'?'A':'T';
    return '<div class="ball '+cls+'">'+letter+'</div>';
  }).join('');
  const linhas = history.map((h,i)=>{
    const col = h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308';
    return '<tr><td>#'+(total-i)+'</td><td><span style="color:'+col+';font-weight:700">'+h.winner+'</span></td><td>'+h.time+'</td></tr>';
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vander Placar</title><script src="https://cdn.tailwindcss.com"></script><script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{background:#060a14;color:#e2e8f0;font-family:system-ui;padding:12px}
.glass{background:rgba(17,24,39,0.9);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:16px}
.ball{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid}
.ball.home{color:#ef4444;border-color:#ef4444;background:rgba(239,68,68,0.15)}
.ball.away{color:#3b82f6;border-color:#3b82f6;background:rgba(59,130,246,0.15)}
.ball.tie{color:#eab308;border-color:#eab308;background:rgba(234,179,8,0.15)}
.live-dot{width:8px;height:8px;background:#10b981;border-radius:50%;display:inline-block;animation:pulse 1.5s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 #10b981}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
</style></head><body>
<div style="max-width:1100px;margin:0 auto">
<div class="glass" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
<div><h1 style="font-size:22px;font-weight:900">VANDER <span style="color:#10b981">PLACAR</span></h1><p style="font-size:11px;color:#6b7280">FOOTBALL STUDIO • AO VIVO • JOKER REAL</p><p style="font-size:12px;color:#10b981;margin-top:4px">${botStatus}</p></div>
<div style="text-align:right"><div><span class="live-dot"></span> <span style="color:#10b981;font-size:11px;font-weight:700">LIVE</span></div><div style="font-size:10px;color:#6b7280;margin-top:4px">Auto-renew ON</div></div>
</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
<div class="glass" style="text-align:center"><div style="font-size:10px;color:#6b7280">TOTAL</div><div style="font-size:28px;font-weight:800">${total}</div></div>
<div class="glass" style="text-align:center;border-left:2px solid #ef4444"><div style="font-size:10px;color:#ef4444">HOME</div><div style="font-size:24px;font-weight:800;color:#ef4444">${stats.HOME||0} <span style="font-size:12px;color:#6b7280">${homePct}%</span></div></div>
<div class="glass" style="text-align:center;border-left:2px solid #3b82f6"><div style="font-size:10px;color:#3b82f6">AWAY</div><div style="font-size:24px;font-weight:800;color:#3b82f6">${stats.AWAY||0} <span style="font-size:12px;color:#6b7280">${awayPct}%</span></div></div>
<div class="glass" style="text-align:center;border-left:2px solid #eab308"><div style="font-size:10px;color:#eab308">TIE</div><div style="font-size:24px;font-weight:800;color:#eab308">${stats.TIE||0} <span style="font-size:12px;color:#6b7280">${tiePct}%</span></div></div>
</div>

<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:12px">
<div class="glass"><h3 style="font-size:11px;color:#6b7280;margin-bottom:10px">PLACAR GRANDE • 200 • REAL TIME</h3><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center" id="bolas">${bolas||'Aguardando...'}</div></div>
<div class="glass"><h3 style="font-size:10px;color:#6b7280;margin-bottom:8px">DISTRIBUIÇÃO</h3><canvas id="c1" height="160"></canvas></div>
</div>

<div class="glass"><h3 style="font-size:11px;color:#6b7280;margin-bottom:10px">HISTÓRICO • 200</h3><table style="width:100%;font-size:13px"><thead><tr style="color:#6b7280;font-size:10px"><th>#</th><th>Resultado</th><th>Hora</th></tr></thead><tbody id="tbody">${linhas||'<tr><td colspan=3 style="text-align:center;padding:20px;color:#6b7280">Conectando...</td></tr>'}</tbody></table></div>
</div>

<script>
let ch;
async function load(){
  try{
    const [s,r]=await Promise.all([fetch('/api/stats').then(x=>x.json()), fetch('/api/rounds').then(x=>x.json())]);
    document.getElementById('bolas').innerHTML = r.data.map(h=>{
      const cls=h.winner==='HOME'?'home':h.winner==='AWAY'?'away':'tie';
      return '<div class="ball '+cls+'">'+h.winner[0]+'</div>';
    }).join('')||'Aguardando...';
    document.getElementById('tbody').innerHTML = r.data.map((h,i)=>'<tr><td>#'+(r.data.length-i)+'</td><td style="color:'+(h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308')+';font-weight:700">'+h.winner+'</td><td>'+h.time+'</td></tr>').join('');
    if(ch) ch.destroy();
    ch=new Chart(document.getElementById('c1'),{type:'doughnut',data:{labels:['HOME','AWAY','TIE'],datasets:[{data:[s.stats.HOME||0,s.stats.AWAY||0,s.stats.TIE||0],backgroundColor:['#ef4444','#3b82f6','#eab308']}]},options:{plugins:{legend:{labels:{color:'#9ca3af',font:{size:10}}}},cutout:'60%'}});
  }catch(e){}
}
load(); setInterval(load,5000);
</script>
</body></html>`;

  res.send(html);
});

const PORT=process.env.PORT||10000;
app.listen(PORT,()=>{ console.log('VANDER PLACAR leve na porta '+PORT); start(); });

