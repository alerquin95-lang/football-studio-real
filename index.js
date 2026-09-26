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
let isCollecting = false;

function loadHistory(){
  try{
    if(fs.existsSync('./token.json')){
      const tj=JSON.parse(fs.readFileSync('./token.json','utf8'));
      if(tj.token) SUPABASE_AUTH_TOKEN = tj.token;
    }
    if(fs.existsSync('./history.json')){
      const d=JSON.parse(fs.readFileSync('./history.json','utf8'));
      history=d.slice(0,400); stats={HOME:0,AWAY:0,TIE:0};
      d.forEach(h=>{ if(stats[h.winner]!==undefined) stats[h.winner]++; });
    }
  }catch(e){}
}
function saveHistory(){ try{ fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,400))); }catch(e){} }
function addResult(w,row){
  if(history[0]?.round_id && row?.id && history[0].round_id===row.id) return false;
  const e={ round_id: row.id, winner: w.toUpperCase(), time: new Date().toLocaleTimeString('pt-BR'), ts: Date.now() };
  history.unshift(e); if(history.length>400) history.pop(); stats[e.winner]=(stats[e.winner]||0)+1; saveHistory(); return true;
}

async function refreshTokenAuto(){
  try{
    botStatus = '🔄 Renovando token automaticamente...';
    const res=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body: JSON.stringify({email:SITE_USER,password:SITE_PASS})
    });
    const data=await res.json();
    if(data.access_token){
      SUPABASE_AUTH_TOKEN=data.access_token;
      fs.writeFileSync('./token.json', JSON.stringify({token:data.access_token, time:new Date().toISOString()}));
      botStatus='✅ Token renovado automaticamente';
      return true;
    } else {
      botStatus='Erro ao renovar token';
      return false;
    }
  }catch(e){ lastError=e.message; return false; }
}

function normalizeWinner(raw){
  const s = (raw||'').toString().trim().toUpperCase();
  if(['HOME','H','CASA','1','RED'].includes(s)) return 'HOME';
  if(['AWAY','A','FORA','2','BLUE'].includes(s)) return 'AWAY';
  if(['TIE','T','EMPATE','0','X'].includes(s)) return 'TIE';
  if(s.includes('HOME')) return 'HOME';
  if(s.includes('AWAY')) return 'AWAY';
  if(s.includes('TIE')) return 'TIE';
  return null;
}


async function tryFetchTable(table){
  try{
    let headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
    let url = SUPABASE_URL+'/rest/v1/'+table+'?select=*&order=created_at.desc&limit=400';
    let res=await fetch(url,{headers});
    if(!res.ok && res.status===401){
      const ok=await refreshTokenAuto();
      if(ok){
        headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
        res=await fetch(url,{headers});
      }
    }
    if(res.ok){
      const data=await res.json();
      if(Array.isArray(data) && data.length>0){
        // log distinct raw winners for debug
        let distinctRaw = {};
        for(let r of data.slice(0,20)){
          const raw = r.winner || r.result || r.outcome || r.winning_side || r.side || 'NULL';
          distinctRaw[raw]=(distinctRaw[raw]||0)+1;
        }
        console.log('[RAW SAMPLE]', JSON.stringify(data[0]).slice(0,500));
        console.log('[DISTINCT RAW]', distinctRaw);
        return data;
      }
    }
    return null;
  }catch(e){ lastError=e.message; return null; }
}

function inferWinnerFromRow(row){
  // tenta todas as colunas possíveis
  let raw = row.winner || row.result || row.outcome || row.winning_side || row.side || row.winningSide || '';
  let norm = normalizeWinner(raw);
  if(norm) return norm;
  // tenta por scores
  if(row.home_score!=null && row.away_score!=null){
    if(Number(row.home_score) > Number(row.away_score)) return 'HOME';
    if(Number(row.away_score) > Number(row.home_score)) return 'AWAY';
    return 'TIE';
  }
  if(row.home!=null && row.away!=null){
    if(Number(row.home) > Number(row.away)) return 'HOME';
    if(Number(row.away) > Number(row.home)) return 'AWAY';
    return 'TIE';
  }
  // tenta por cartas
  if(row.home_card!=null && row.away_card!=null){
    // Football Studio: carta maior vence
    // se for string tipo "K", "Q", etc, converte valor
    const val = (c)=>{
      if(!c) return 0;
      const s=c.toString().toUpperCase();
      if(s.includes('A')) return 14;
      if(s.includes('K')) return 13;
      if(s.includes('Q')) return 12;
      if(s.includes('J')) return 11;
      return parseInt(s)||0;
    };
    const hv = val(row.home_card_value || row.home_card || row.home);
    const av = val(row.away_card_value || row.away_card || row.away);
    if(hv>av) return 'HOME';
    if(av>hv) return 'AWAY';
    return 'TIE';
  }
  return null;
}

async function fetchReal(){
  if(isCollecting) return;
  isCollecting=true;
  try{
    const data = await tryFetchTable('football_studio_rounds');
    if(!data){
      botStatus='Aguardando dados do Joker...';
      isCollecting=false;
      return false;
    }
    let newCount=0;
    let debugCounts={raw:{}, norm:{HOME:0,AWAY:0,TIE:0,UNKNOWN:0}};
    for(let j=data.length-1;j>=0;j--){
      const row=data[j];
      const raw = row.winner || row.result || row.outcome || row.winning_side || row.side || 'NULL';
      debugCounts.raw[raw]=(debugCounts.raw[raw]||0)+1;
      const norm = inferWinnerFromRow(row) || normalizeWinner(raw);
      if(norm){
        debugCounts.norm[norm]=(debugCounts.norm[norm]||0)+1;
        if(!history.find(h=>h.round_id===row.id)){
          if(addResult(norm,row)) newCount++;
        }
      } else {
        debugCounts.norm.UNKNOWN++;
        // log row que não conseguiu inferir
        if(debugCounts.norm.UNKNOWN<3) console.log('[UNKNOWN ROW]', JSON.stringify(row).slice(0,500));
      }
    }
    console.log('[FETCH DEBUG]', debugCounts);
    botStatus='✅ LIVE - '+history.length+'/400 - '+stats.HOME+'H '+stats.AWAY+'A '+stats.TIE+'T | RAW:'+JSON.stringify(debugCounts.raw).slice(0,100)+(newCount?(' +'+newCount):'');
    isCollecting=false;
    return true;
  }catch(e){ lastError=e.message; console.log('[FETCH ERROR]', e); botStatus='Erro: '+e.message; isCollecting=false; return false; }
}


async function start(){ loadHistory(); await fetchReal(); setInterval(fetchReal, 5000); setInterval(refreshTokenAuto, 1000*60*30); }


app.get('/api/raw', async(req,res)=>{
  try{
    let headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
    let url = SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=20';
    let r=await fetch(url,{headers});
    if(!r.ok && r.status===401){ await refreshTokenAuto(); headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'}; r=await fetch(url,{headers}); }
    const data=await r.json();
    let distinct={};
    let sample = data.slice(0,5);
    for(let row of data){
      const raw = row.winner || row.result || row.outcome || row.winning_side || 'NULL';
      distinct[raw]=(distinct[raw]||0)+1;
    }
    res.json({count:data.length, distinct, sample, columns: data[0]?Object.keys(data[0]):[]});
  }catch(e){ res.json({error:e.message}); }
});

app.get('/api/debugfull', async(req,res)=>{
  res.json({history: history.slice(0,10), stats, botStatus, error:lastError, total:history.length});
});

app.get('/api/rounds',(req,res)=>res.json({success:true,count:history.length,botStatus,data:history,error:lastError}));
app.get('/api/stats',(req,res)=>res.json({success:true,stats,total:history.length,botStatus,error:lastError}));
app.get('/api/clear',(req,res)=>{ try{ fs.unlinkSync('./history.json'); }catch(e){} history=[]; stats={HOME:0,AWAY:0,TIE:0}; fetchReal(); res.json({success:true}); });

app.get('/',(req,res)=>{
  const total=history.length;
  const homePct=total?((stats.HOME/total)*100).toFixed(1):0;
  const awayPct=total?((stats.AWAY/total)*100).toFixed(1):0;
  const tiePct=total?((stats.TIE/total)*100).toFixed(1):0;
  const lastWinner = history[0]?.winner || '-';
  const streak = (()=>{ let c=0,t=history[0]?.winner; for(let h of history){ if(h.winner===t) c++; else break; } return {type:t||'-',count:c}; })();

  const bolas = history.map(h=>{
    const cls = h.winner==='HOME'?'home':h.winner==='AWAY'?'away':'tie';
    const letter = h.winner==='HOME'?'H':h.winner==='AWAY'?'A':'T';
    return '<div class="ball '+cls+'" title="'+h.time+'">'+letter+'</div>';
  }).join('');

  const linhas = history.map((h,i)=>{
    const bg = h.winner==='HOME'?'rgba(239,68,68,0.15)':h.winner==='AWAY'?'rgba(59,130,246,0.15)':'rgba(234,179,8,0.15)';
    const col = h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308';
    const dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+col+';margin-right:8px"></span>';
    return '<tr><td style="color:#64748b">#'+(total-i)+'</td><td>'+dot+'<span style="background:'+bg+';color:'+col+';padding:4px 12px;border-radius:20px;font-weight:700;font-size:12px">'+h.winner+'</span></td><td style="color:#94a3b8;font-size:13px">'+h.time+'</td><td><span style="color:#10b981;font-size:11px">JOKER REAL</span></td></tr>';
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vander Placar - 400 Resultados</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
<style>
*{font-family:'Outfit',system-ui} .mono{font-family:'JetBrains Mono',monospace}
body{background:#060a14;color:#e2e8f0;min-height:100vh}
.glass{background:rgba(17,24,39,0.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.06)}
.card-hover{transition:all 0.3s ease} .card-hover:hover{transform:translateY(-2px);border-color:rgba(16,185,129,0.3);box-shadow:0 20px 40px rgba(0,0,0,0.4)}
.ball{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;transition:all 0.2s;cursor:pointer;border:2px solid;animation:pop 0.3s ease}
@keyframes pop{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
.ball.home{background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.05));color:#ef4444;border-color:rgba(239,68,68,0.5);box-shadow:0 0 15px rgba(239,68,68,0.2)}
.ball.away{background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(59,130,246,0.05));color:#3b82f6;border-color:rgba(59,130,246,0.5);box-shadow:0 0 15px rgba(59,130,246,0.2)}
.ball.tie{background:linear-gradient(135deg,rgba(234,179,8,0.2),rgba(234,179,8,0.05));color:#eab308;border-color:rgba(234,179,8,0.5);box-shadow:0 0 15px rgba(234,179,8,0.2)}
.live-dot{width:10px;height:10px;background:#10b981;border-radius:50%;animation:pulse 1.5s infinite;box-shadow:0 0 0 0 #10b981}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,0.7)}70%{box-shadow:0 0 0 10px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
.gradient-text{background:linear-gradient(90deg,#10b981,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
</style>
</head><body class="p-3 md:p-6">
<div class="max-w-7xl mx-auto">
  <div class="glass rounded-[20px] p-5 md:p-7 mb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-black font-black text-xl">V</div>
      <div>
        <h1 class="text-2xl md:text-3xl font-black tracking-tight">VANDER <span class="gradient-text">PLACAR</span></h1>
        <p class="text-[11px] tracking-[0.2em] text-zinc-500 font-bold mt-1">FOOTBALL STUDIO • AO VIVO • 400 RESULTADOS • JOKER REAL</p>
        <p class="text-[12px] text-emerald-400 mt-1 font-semibold" id="statusText">${botStatus}</p>
      </div>
    </div>
    <div class="flex items-center gap-6">
      <div class="text-right">
        <div class="flex items-center gap-2 justify-end"><div class="live-dot"></div><span class="text-emerald-400 font-black text-[11px] tracking-widest">LIVE</span></div>
        <div class="text-[11px] text-zinc-500 mt-1">Streak: <span class="text-white font-bold">${streak.type} x${streak.count}</span></div>
        <div class="text-[10px] text-zinc-600 mt-1">Último: <span class="mono text-white">${lastWinner}</span></div>
      </div>
      <div class="hidden md:block w-px h-12 bg-white/10"></div>
      <div class="text-right hidden md:block">
        <div class="text-[10px] text-zinc-500">FONTE</div>
        <div class="text-[12px] font-bold text-white">jokeria.app</div>
        <div class="text-[10px] text-emerald-400">400 • Auto-renew</div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
    <div class="glass rounded-2xl p-5 card-hover">
      <div class="flex justify-between items-start mb-3"><span class="text-[10px] tracking-widest text-zinc-500 font-bold">TOTAL REAL</span><span class="text-[10px] bg-white/10 px-2 py-1 rounded-full">400 max</span></div>
      <div class="text-4xl font-black mono">${total}</div>
      <div class="text-[11px] text-zinc-500 mt-2">Resultados do Joker</div>
    </div>
    <div class="glass rounded-2xl p-5 card-hover border-l-2 border-l-red-500/50">
      <div class="text-[10px] tracking-widest text-red-400 font-bold mb-3">HOME • VERMELHO</div>
      <div class="text-3xl font-black mono text-red-400">${stats.HOME||0} <span class="text-[14px] text-zinc-500">${homePct}%</span></div>
    </div>
    <div class="glass rounded-2xl p-5 card-hover border-l-2 border-l-blue-500/50">
      <div class="text-[10px] tracking-widest text-blue-400 font-bold mb-3">AWAY • AZUL</div>
      <div class="text-3xl font-black mono text-blue-400">${stats.AWAY||0} <span class="text-[14px] text-zinc-500">${awayPct}%</span></div>
    </div>
    <div class="glass rounded-2xl p-5 card-hover border-l-2 border-l-amber-400/50">
      <div class="text-[10px] tracking-widest text-amber-400 font-bold mb-3">TIE • AMARELO</div>
      <div class="text-3xl font-black mono text-amber-400">${stats.TIE||0} <span class="text-[14px] text-zinc-500">${tiePct}%</span></div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
    <div class="lg:col-span-2 glass rounded-[20px] p-5 md:p-6">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-[11px] tracking-[0.2em] text-zinc-400 font-black">PLACAR GRANDE • ÚLTIMOS 400 • REAL TIME</h2>
        <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold">AUTO-UPDATE 5s</span>
      </div>
      <div class="flex flex-wrap gap-2 justify-center min-h-[120px]" id="placarBolas">
        ${bolas || '<div class="text-zinc-600 py-10">Aguardando dados reais do Joker...</div>'}
      </div>
    </div>
    <div class="space-y-4">
      <div class="glass rounded-[20px] p-5">
        <h3 class="text-[10px] tracking-widest text-zinc-500 font-bold mb-4">DISTRIBUIÇÃO</h3>
        <canvas id="distChart" height="180"></canvas>
      </div>
      <div class="glass rounded-[20px] p-5">
        <h3 class="text-[10px] tracking-widest text-zinc-500 font-bold mb-4">TIMELINE 50</h3>
        <canvas id="timelineChart" height="160"></canvas>
      </div>
    </div>
  </div>

  <div class="glass rounded-[20px] p-5 md:p-6">
    <div class="flex justify-between items-center mb-5">
      <h2 class="text-[11px] tracking-[0.2em] text-zinc-400 font-black">HISTÓRICO REAL • JOKER • ÚLTIMOS 400</h2>
      <span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full">Auto-renew ON</span>
    </div>
    <div class="overflow-x-auto max-h-[500px] overflow-y-auto">
      <table class="w-full"><thead class="sticky top-0 bg-[#0e1422]/90 backdrop-blur"><tr><th class="text-left p-3 text-[10px] text-zinc-500">#</th><th class="text-left p-3 text-[10px] text-zinc-500">RESULTADO</th><th class="text-left p-3 text-[10px] text-zinc-500">HORA</th><th class="text-left p-3 text-[10px] text-zinc-500">FONTE</th></tr></thead><tbody id="tabelaBody">${linhas || '<tr><td colspan=4 class="text-center py-10 text-zinc-600">Conectando ao banco REAL do Joker...</td></tr>'}</tbody></table>
    </div>
  </div>
</div>

<script>
let chart1, chart2;
async function loadData(){
  try{
    const [rStats, rRounds] = await Promise.all([fetch('/api/stats').then(r=>r.json()), fetch('/api/rounds').then(r=>r.json())]);
    document.getElementById('statusText').innerText = rStats.botStatus || 'Conectado';
    const bolas = rRounds.data.map(h=>{
      const cls = h.winner==='HOME'?'home':h.winner==='AWAY'?'away':'tie';
      const letter = h.winner==='HOME'?'H':h.winner==='AWAY'?'A':'T';
      return '<div class="ball '+cls+'" title="'+h.time+'">'+letter+'</div>';
    }).join('');
    document.getElementById('placarBolas').innerHTML = bolas || '<div class="text-zinc-600 py-10">Aguardando...</div>';
    const linhas = rRounds.data.map((h,i)=>{
      const bg = h.winner==='HOME'?'rgba(239,68,68,0.15)':h.winner==='AWAY'?'rgba(59,130,246,0.15)':'rgba(234,179,8,0.15)';
      const col = h.winner==='HOME'?'#ef4444':h.winner==='AWAY'?'#3b82f6':'#eab308';
      const dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+col+';margin-right:8px"></span>';
      return '<tr><td style="color:#64748b">#'+(rRounds.data.length-i)+'</td><td>'+dot+'<span style="background:'+bg+';color:'+col+';padding:4px 12px;border-radius:20px;font-weight:700;font-size:12px">'+h.winner+'</span></td><td style="color:#94a3b8;font-size:13px">'+h.time+'</td><td><span style="color:#10b981;font-size:11px">JOKER REAL</span></td></tr>';
    }).join('');
    document.getElementById('tabelaBody').innerHTML = linhas;
    const s = rStats.stats || {HOME:0,AWAY:0,TIE:0};
    if(chart1) chart1.destroy();
    chart1 = new Chart(document.getElementById('distChart'), {
      type:'doughnut',
      data:{ labels:['HOME','AWAY','TIE'], datasets:[{ data:[s.HOME,s.AWAY,s.TIE], backgroun
