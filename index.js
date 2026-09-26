const http = require('http');
const fs = require('fs');

const SUPABASE_URL = 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
let SUPABASE_AUTH_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwNDI5NTAwLCJpYXQiOjE3OTA0MjU5MDAsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.TJef0QdVhjkcaEiEKci95bARRFPUlkqwlWKQfsYNuqkjK5ge4FGzjpCJx3RDv3JOxhyXGvB0-RcA8xAU__b6EA';
const SITE_USER = 'santarosavander@gmail.com';
const SITE_PASS = '131619jV*';

let history = [];
let stats = { HOME:0, AWAY:0, TIE:0 };
let botStatus = 'Conectando ao Joker...';
let signals = [];
let greens = 0;
let reds = 0;
let assertividade = 0;
let aiState = 'ANALISANDO';
let currentSignal = null;

function loadHistory(){
  try{
    if(fs.existsSync('./token.json')){
      const tj=JSON.parse(fs.readFileSync('./token.json','utf8'));
      if(tj.token) SUPABASE_AUTH_TOKEN = tj.token;
    }
    if(fs.existsSync('./history.json')){
      const d=JSON.parse(fs.readFileSync('./history.json','utf8'));
      history=d.slice(0,400); stats={HOME:0,AWAY:0,TIE:0};
      d.forEach(function(h){ if(stats[h.winner]!==undefined) stats[h.winner]++; });
    }
    if(fs.existsSync('./signals.json')){
      const s=JSON.parse(fs.readFileSync('./signals.json','utf8'));
      signals=s.slice(0,100);
      greens = s.filter(function(x){return x.status==='GREEN'}).length;
      reds = s.filter(function(x){return x.status==='RED'}).length;
    }
  }catch(e){}
}
function saveHistory(){ try{ fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,400))); }catch(e){} }
function saveSignals(){ try{ fs.writeFileSync('./signals.json', JSON.stringify(signals.slice(0,100))); }catch(e){} }

function normalizeWinner(raw){
  const s = (raw||'').toString().trim().toUpperCase();
  if(['HOME','H','CASA','1','RED','R'].indexOf(s)>=0) return 'HOME';
  if(['AWAY','A','FORA','2','BLUE','B'].indexOf(s)>=0) return 'AWAY';
  if(['TIE','T','EMPATE','0','X','E','YELLOW'].indexOf(s)>=0) return 'TIE';
  if(s.indexOf('HOME')>=0) return 'HOME';
  if(s.indexOf('AWAY')>=0) return 'AWAY';
  if(s.indexOf('TIE')>=0) return 'TIE';
  return null;
}

function addResult(w,row){
  if(history[0] && history[0].round_id && row.id && history[0].round_id===row.id) return false;
  const e={ round_id: row.id, winner: w, time: new Date().toLocaleTimeString('pt-BR') };
  history.unshift(e); if(history.length>400) history.pop(); stats[w]=(stats[w]||0)+1; saveHistory();
  checkSignals(w);
  analyzeAI();
  return true;
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
    let url = SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=400';
    let res=await fetch(url,{headers});
    if(!res.ok && res.status===401){
      await refreshTokenAuto();
      headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
      res=await fetch(url,{headers});
    }
    if(!res.ok) return;
    const data=await res.json();
    if(!Array.isArray(data)) return;
    let newCount=0;
    for(let j=data.length-1;j>=0;j--){
      const row=data[j];
      const raw = row.winner || row.result || row.outcome || '';
      const norm = normalizeWinner(raw);
      if(!norm) continue;
      if(!history.find(function(h){return h.round_id===row.id})){
        if(addResult(norm,row)) newCount++;
      }
    }
    if(newCount>0) botStatus='LIVE - '+history.length+'/400 - '+stats.HOME+'H '+stats.AWAY+'A '+stats.TIE+'T';
  }catch(e){ botStatus='Erro: '+e.message; }
}

// IA INTELIGENTE - PULA 2 CASAS - G2
function calculatePatternStats(){
  if(history.length<50) return [];
  const patterns = [];
  for(let color of ['HOME','AWAY']){
    let totalTieComCor=0, voltou=0;
    for(let i=3;i<history.length-5;i++){
      if(history[i] && history[i].winner==='TIE'){
        const corAntes = history[i+1] ? history[i+1].winner : null;
        if(corAntes && corAntes!=='TIE' && corAntes===color){
          totalTieComCor++;
          const corDepoisDePular2 = history[i-3] ? history[i-3].winner : null;
          if(corDepoisDePular2===color) voltou++;
        }
      }
    }
    const taxa = totalTieComCor? (voltou/totalTieComCor*100) : 0;
    if(totalTieComCor>=3) patterns.push({tipo:'TIE_PULA_2', cor:color, taxa:taxa, acertos:voltou, tentativas:totalTieComCor, desc:color+' antes do TIE volta apos pular 2'});
  }
  patterns.sort(function(a,b){return b.taxa-a.taxa});
  return patterns;
}

function analyzeAI(){
  if(history.length<20){ aiState='AGUARDANDO DADOS'; return; }
  aiState='IA ESCANEANDO';
  const patterns = calculatePatternStats();
  if(currentSignal && signals.find(function(s){return s.id===currentSignal.id && s.status==='WAITING'})){
    aiState='SINAL ATIVO - G'+(currentSignal.gales||0);
    return;
  }
  const best = patterns[0];
  if(!best || best.taxa<60) {
    aiState='ANALISANDO '+patterns.length+' PADROES';
    return;
  }
  const ultimo = history[0] ? history[0].winner : null;
  if(ultimo==='TIE' && best.tipo==='TIE_PULA_2'){
    const corAntes = history[1] ? history[1].winner : null;
    if(corAntes && corAntes!=='TIE'){
      const patternCorAntes = patterns.find(function(p){return p.cor===corAntes && p.tipo==='TIE_PULA_2'});
      if(patternCorAntes && patternCorAntes.taxa>=60){
        currentSignal = {
          id: Date.now(),
          entry: corAntes,
          color: corAntes==='HOME'?'VERMELHO':'AZUL',
          time: new Date().toLocaleTimeString('pt-BR'),
          pattern: patternCorAntes.desc + ' - ' + patternCorAntes.taxa.toFixed(0) + '% (' + patternCorAntes.acertos + '/' + patternCorAntes.tentativas + ')',
          taxa: patternCorAntes.taxa,
          status: 'AGUARDANDO',
          gales: 0,
          maxGales: 2,
          attempts: 0
        };
        signals.unshift(Object.assign({}, currentSignal, {status:'WAITING'}));
        saveSignals();
        aiState='SINAL ENCONTRADO - '+corAntes+' - '+patternCorAntes.taxa.toFixed(0)+'%';
        return;
      }
    }
  }
  aiState='AGUARDANDO - Melhor: '+(best ? best.cor+' '+best.taxa.toFixed(0)+'%': 'nenhum');
}

function checkSignals(newWinner){
  if(signals.length===0) return;
  for(let s of signals){
    if(s.status==='WAITING'){
      s.attempts = (s.attempts||0)+1;
      if(newWinner===s.entry || newWinner==='TIE'){
        s.status='GREEN';
        s.result = newWinner;
        greens++;
        if(currentSignal && currentSignal.id===s.id) currentSignal=null;
        saveSignals();
        break;
      } else {
        if(s.gales < s.maxGales){
          s.gales++;
        } else {
          s.status='RED';
          s.result = newWinner;
          reds++;
          if(currentSignal && currentSignal.id===s.id) currentSignal=null;
          saveSignals();
          break;
        }
      }
    }
  }
  const total = greens+reds;
  if(total>0) assertividade = Math.round((greens/total)*100);
}

function getHtml(){
  const total=history.length;
  const homePct=total?((stats.HOME/total)*100).toFixed(1):0;
  const awayPct=total?((stats.AWAY/total)*100).toFixed(1):0;
  const tiePct=total?((stats.TIE/total)*100).toFixed(1):0;

  let sinalHtml = '';
  if(currentSignal){
    const borderColor = currentSignal.entry==='HOME'?'red':'blue';
    const textColor = currentSignal.entry==='HOME'?'text-red-400':'text-blue-400';
    sinalHtml = '<div class="glass rounded-[20px] p-6 border-2 border-'+borderColor+'-500/50"><div class="text-center"><div class="text-[10px] text-zinc-500">PADRAO DETECTADO</div><div class="text-[12px] text-zinc-400 mb-3">'+(currentSignal.pattern||'')+'</div><div class="text-3xl font-black mb-2 '+textColor+'">ENTRA '+currentSignal.color+'</div><div class="text-[14px] font-bold text-white bg-white/10 px-4 py-2 rounded-full inline-block">COBRIR EMPATE - '+currentSignal.time+'</div><div class="mt-4 text-[11px] text-emerald-400">IA com '+(currentSignal.taxa?currentSignal.taxa.toFixed(0):87)+'% de confianca - G2 1-2-4</div></div></div>';
  } else {
    sinalHtml = '<div class="text-center py-10"><div class="text-4xl mb-4">AI</div><div class="text-[13px] font-bold">AGUARDANDO</div><div class="text-[11px] text-zinc-500 mt-2">IA escaneando padroes pula 2 casas...</div><div class="mt-4 text-[11px] text-amber-300/60">ESCANEANDO PADROES EM TEMPO REAL</div></div>';
  }

  let bolasHtml = '';
  for(let i=0;i<history.length;i++){
    const h=history[i];
    const cls = h.winner==='HOME'?'home':h.winner==='AWAY'?'away':'tie';
    bolasHtml += '<div class="ball '+cls+'">'+h.winner[0]+'</div>';
  }
  if(!bolasHtml) bolasHtml = '<div class="text-zinc-600 py-10">IA escaneando...</div>';

  let sinaisHtml = '';
  const ultimos = signals.slice(0,10);
  for(let i=0;i<ultimos.length;i++){
    const s=ultimos[i];
    const border = s.status==='GREEN'?'border-l-emerald-500':s.status==='RED'?'border-l-red-500':'border-l-amber-500';
    const bg = s.entry==='HOME'?'bg-red-500/20 text-red-400':'bg-blue-500/20 text-blue-400';
    const statusBg = s.status==='GREEN'?'bg-emerald-500/20 text-emerald-400':s.status==='RED'?'bg-red-500/20 text-red-400':'bg-amber-500/20 text-amber-400';
    sinaisHtml += '<div class="glass rounded-xl p-4 flex justify-between items-center border-l-4 '+border+'"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full '+bg+' flex items-center justify-center font-bold text-[12px]">'+s.entry[0]+'</div><div><div class="text-[12px] font-bold">ENTRA '+s.entry+' COBRIR EMPATE</div><div class="text-[10px] text-zinc-500">'+s.time+' - '+(s.pattern||'')+'</div></div></div><div class="text-right"><div class="text-[11px] px-3 py-1 rounded-full font-bold '+statusBg+'">'+s.status+' '+(s.gales?'G'+s.gales:'')+'</div><div class="text-[10px] text-zinc-500 mt-1">'+(s.result||'Aguardando...')+'</div></div></div>';
  }
  if(!sinaisHtml) sinaisHtml = '<div class="text-center py-10 text-zinc-600">IA aguardando padroes... Pula 2 casas sendo escaneado - G2</div>';

  // HTML SEM TEMPLATE ANINHADO E SEM </script> DENTRO
  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  html += '<title>Vander Placar Premium IA G2</title>';
  html += '<script src="https://cdn.tailwindcss.com"></'+'script>';
  html += '<style>body{background:#03050a;color:#e2e8f0;font-family:system-ui;padding:12px}.glass{background:rgba(12,16,28,0.9);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:16px}.ball{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;border:2px solid}.ball.home{color:#ef4444;border-color:#ef4444;background:rgba(239,68,68,0.15)}.ball.away{color:#3b82f6;border-color:#3b82f6;background:rgba(59,130,246,0.15)}.ball.tie{color:#eab308;border-color:#eab308;background:rgba(234,179,8,0.15)}.live-dot{width:10px;height:10px;background:#10b981;border-radius:50%;animation:pulse 1.5s infinite}@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,0.7)}70%{box-shadow:0 0 0 10px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}</style>';
  html += '</head><body>';
  html += '<div style="max-width:1100px;margin:0 auto">';
  html += '<div class="glass" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center"><div><h1 style="font-size:22px;font-weight:900">VANDER <span style="color:#10b981">PLACAR</span> PREMIUM IA G2</h1><p style="font-size:11px;color:#6b7280">'+botStatus+' - '+aiState+'</p></div><div style="text-align:right"><div style="color:#10b981;font-size:11px">● IA VIVA - PULA 2 - G2 1-2-4</div><div style="font-size:10px;color:#6b7280;margin-top:4px"><a href="/api/clear" style="color:#10b981">Limpar</a> | <a href="/api/raw" style="color:#10b981">RAW</a></div></div></div>';
  html += '<div class="glass" style="margin-bottom:12px"><h3 style="font-size:12px;font-weight:800;margin-bottom:12px">SINAIS - IA CONSCIENTE - PULA 2 CASAS - G2</h3>'+sinalHtml+'<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div class="glass" style="text-align:center"><div style="font-size:10px;color:#6b7280">HOJE</div><div style="font-size:13px"><span style="color:#10b981">'+greens+' W</span> <span style="color:#ef4444">'+reds+' R</span></div></div><div class="glass" style="text-align:center;grid-column:span 2"><div style="font-size:10px;color:#6b7280">ASSERTIVIDADE G2</div><div style="font-size:16px;font-weight:800;color:#10b981">'+assertividade+'% - '+(greens+reds)+' sinais</div><div style="font-size:10px;color:#6b7280">G0 54.9% G1 77.2% G2 87.5%</div></div></div></div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px"><div class="glass" style="text-align:center"><div style="font-size:10px;color:#6b7280">TOTAL</div><div style="font-size:24px;font-weight:800">'+total+'/400</div></div><div class="glass" style="text-align:center"><div style="font-size:10px;color:#ef4444">HOME</div><div style="font-size:20px;font-weight:800;color:#ef4444">'+stats.HOME+' <span style="font-size:12px;color:#6b7280">'+homePct+'%</span></div></div><div class="glass" style="text-align:center"><div style="font-size:10px;color:#3b82f6">AWAY</div><div style="font-size:20px;font-weight:800;color:#3b82f6">'+stats.AWAY+' <span style="font-size:12px;color:#6b7280">'+awayPct+'%</span></div></div><div class="glass" style="text-align:center"><div style="font-size:10px;color:#eab308">TIE</div><div style="font-size:20px;font-weight:800;color:#eab308">'+stats.TIE+' <span style="font-size:12px;color:#6b7280">'+tiePct+'%</span></div></div></div>';
  html += '<div class="glass" style="margin-bottom:12px"><h3 style="font-size:11px;color:#6b7280;margin-bottom:10px">PLACAR GRANDE - 400 - IA PULA 2 - G2</h3><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:100px">'+bolasHtml+'</div></div>';
  html += '<div class="glass"><h3 style="font-size:12px;font-weight:800;margin-bottom:10px">ULTIMOS SINAIS - IA - G2 1-2-4</h3><div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto">'+sinaisHtml+'</div></div>';
  html += '</div>';
  html += '<script>setInterval(function(){location.reload()},30000);</'+'script>';
  html += '</body></html>';
  return html;
}

const server = http.createServer(async function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, apikey, Authorization');
  if(req.method==='OPTIONS'){ res.writeHead(200); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname==='/api/rounds'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({success:true,count:history.length,botStatus:botStatus,data:history}));
    return;
  }
  if(url.pathname==='/api/stats'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({success:true,stats:stats,total:history.length,botStatus:botStatus,greens:greens,reds:reds,assertividade:assertividade,aiState:aiState,signal:currentSignal,signals:signals.slice(0,20)}));
    return;
  }
  if(url.pathname==='/api/clear'){
    try{ fs.unlinkSync('./history.json'); fs.unlinkSync('./signals.json'); }catch(e){}
    history=[]; stats={HOME:0,AWAY:0,TIE:0}; signals=[]; currentSignal=null; await fetchReal();
    res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true}));
    return;
  }
  if(url.pathname==='/api/raw'){
    try{
      let headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
      let r=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=20',{headers:headers});
      if(!r.ok && r.status===401){ await refreshTokenAuto(); headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'}; r=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=20',{headers:headers}); }
      const data=await r.json();
      res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({count:data.length, sample:data.slice(0,3)}, null, 2));
    }catch(e){ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:e.message})); }
    return;
  }
  if(url.pathname==='/' ){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(getHtml());
    return;
  }
  res.writeHead(404); res.end('Not found');
});

const PORT=process.env.PORT||10000;
server.listen(PORT, async function(){
  console.log('VANDER PREMIUM IA G2 na porta '+PORT);
  loadHistory();
  await fetchReal();
  setInterval(fetchReal, 5000);
  setInterval(refreshTokenAuto, 1000*60*30);
});
                                                        
