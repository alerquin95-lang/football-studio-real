const http = require('http');
const fs = require('fs');
const https = require('https');

if(typeof global.fetch === 'undefined'){
  global.fetch = function(url, opts){
    opts = opts || {};
    return new Promise(function(resolve, reject){
      const u = new URL(url);
      const lib = u.protocol==='https:'?https:http;
      const req = lib.request({
        method: opts.method||'GET',
        hostname: u.hostname,
        path: u.pathname+u.search,
        headers: opts.headers||{}
      }, function(res){
        let data='';
        res.on('data', function(c){data+=c;});
        res.on('end', function(){
          resolve({
            ok: res.statusCode>=200 && res.statusCode<300,
            status: res.statusCode,
            json: function(){ try{return Promise.resolve(JSON.parse(data))}catch(e){return Promise.resolve({})} },
            text: function(){ return Promise.resolve(data) }
          });
        });
      });
      req.on('error', reject);
      if(opts.body) req.write(opts.body);
      req.end();
    });
  };
}

const SUPABASE_URL = 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc0NDM0MDUsImV4cCI6MjA0MzAxOTQwNX0.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
let SUPABASE_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJpYXQiOjE3NTkwNzQzNjYsImV4cCI6MTc5MDQyOTUwMCwiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwicGhvbmUiOiI1NTQ3OTk5NDIyNjE1Iiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.7G5J8L9M0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8';
const SITE_USER = 'santarosavander@gmail.com';
const SITE_PASS = '131619jV*';

let history = [];
let stats = {HOME:0, AWAY:0, TIE:0};
let botStatus = 'Conectando...';
let signals = [];
let greens = 0;
let reds = 0;
let assertividade = 0;
let aiState = 'INICIANDO';
let currentSignal = null;

function loadHistory(){
  try{
    if(fs.existsSync('./token.json')){
      const tj=JSON.parse(fs.readFileSync('./token.json','utf8'));
      if(tj.token) SUPABASE_AUTH_TOKEN = tj.token;
    }
    if(fs.existsSync('./history.json')){
      const d=JSON.parse(fs.readFileSync('./history.json','utf8'));
      history=d.slice(0,400);
      stats={HOME:0,AWAY:0,TIE:0};
      for(let i=0;i<d.length;i++){ if(stats[d[i].winner]!==undefined) stats[d[i].winner]++; }
    }
    if(fs.existsSync('./signals.json')){
      const s=JSON.parse(fs.readFileSync('./signals.json','utf8'));
      signals=s.slice(0,100);
      greens = s.filter(function(x){return x.status==='GREEN'}).length;
      reds = s.filter(function(x){return x.status==='RED'}).length;
      const tot = greens+reds;
      if(tot>0) assertividade = Math.round((greens/tot)*100);
    }
  }catch(e){}
}
function saveHistory(){ try{ fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,400))); }catch(e){} }
function saveSignals(){ try{ fs.writeFileSync('./signals.json', JSON.stringify(signals.slice(0,100))); }catch(e){} }

function normalizeWinner(raw){
  if(!raw) return null;
  const s = raw.toString().trim().toUpperCase();
  if(['HOME','H','CASA','1','RED','R'].indexOf(s)>=0) return 'HOME';
  if(['AWAY','A','FORA','2','BLUE','B'].indexOf(s)>=0) return 'AWAY';
  if(['TIE','T','EMPATE','0','X','E','YELLOW','DRAW'].indexOf(s)>=0) return 'TIE';
  if(s.indexOf('HOME')>=0) return 'HOME';
  if(s.indexOf('AWAY')>=0) return 'AWAY';
  if(s.indexOf('TIE')>=0 || s.indexOf('EMPATE')>=0) return 'TIE';
  return null;
}

function inferWinnerFromRow(row){
  let raw = row.winner || row.result || row.outcome || row.winning_side || row.winningSide || row.side || '';
  let norm = normalizeWinner(raw);
  if(norm) return norm;
  if(row.home_score!=null && row.away_score!=null){
    const hs = Number(row.home_score);
    const as = Number(row.away_score);
    if(hs>as) return 'HOME';
    if(as>hs) return 'AWAY';
    return 'TIE';
  }
  if(row.home_card_value!=null && row.away_card_value!=null){
    const hv = Number(row.home_card_value);
    const av = Number(row.away_card_value);
    if(hv>av) return 'HOME';
    if(av>hv) return 'AWAY';
    return 'TIE';
  }
  return null;
}

function addResult(w,row){
  if(history[0] && history[0].round_id && row.id && history[0].round_id===row.id) return false;
  const e={ round_id: row.id, winner: w, time: new Date().toLocaleTimeString('pt-BR') };
  history.unshift(e);
  if(history.length>400) history.pop();
  stats[w]=(stats[w]||0)+1;
  saveHistory();
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
    let res=await fetch(url,{headers:headers});
    if(!res.ok && res.status===401){
      await refreshTokenAuto();
      headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
      res=await fetch(url,{headers:headers});
    }
    if(!res.ok){ botStatus='Erro Supabase: '+res.status; return; }
    const data=await res.json();
    if(!Array.isArray(data) || data.length===0){ botStatus='Aguardando dados...'; return; }
    let newCount=0;
    for(let j=data.length-1;j>=0;j--){
      const row=data[j];
      const norm = inferWinnerFromRow(row);
      if(!norm) continue;
      let exists=false;
      for(let k=0;k<history.length;k++){ if(history[k].round_id===row.id){exists=true;break;} }
      if(!exists){ if(addResult(norm,row)) newCount++; }
    }
    botStatus='LIVE - '+history.length+'/400 - '+stats.HOME+'H '+stats.AWAY+'A '+stats.TIE+'T'+(newCount?(' +'+newCount):'');
  }catch(e){ botStatus='Erro: '+e.message; }
}

function calculatePatternStats(){
  if(history.length<50) return [];
  const patterns=[];
  for(let color of ['HOME','AWAY']){
    let totalTieComCor=0, voltou=0;
    for(let i=3;i<history.length-5;i++){
      if(history[i] && history[i].winner==='TIE'){
        const corAntes = history[i+1] ? history[i+1].winner : null;
        if(corAntes && corAntes!=='TIE' && corAntes===color){
          totalTieComCor++;
          const corDepois = history[i-3] ? history[i-3].winner : null;
          if(corDepois===color) voltou++;
        }
      }
    }
    const taxa = totalTieComCor? (voltou/totalTieComCor*100) : 0;
    if(totalTieComCor>=3) patterns.push({tipo:'TIE_PULA_2', cor:color, taxa:taxa, acertos:voltou, tentativas:totalTieComCor});
  }
  patterns.sort(function(a,b){return b.taxa-a.taxa;});
  return patterns;
}

function analyzeAI(){
  if(history.length<20){ aiState='AGUARDANDO DADOS '+history.length; return; }
  aiState='IA ESCANEANDO '+history.length;
  const patterns = calculatePatternStats();
  if(currentSignal){
    for(let i=0;i<signals.length;i++){
      if(signals[i].id===currentSignal.id && signals[i].status==='WAITING'){
        aiState='SINAL ATIVO G'+(currentSignal.gales||0);
        return;
      }
    }
  }
  const best = patterns[0];
  if(!best || best.taxa<60){ aiState='ANALISANDO Melhor: '+(best?best.cor+' '+best.taxa.toFixed(0)+'%':'nenhum'); return; }
  const ultimo = history[0] ? history[0].winner : null;
  if(ultimo==='TIE'){
    const corAntes = history[1] ? history[1].winner : null;
    if(corAntes && corAntes!=='TIE'){
      let pat = null;
      for(let i=0;i<patterns.length;i++){ if(patterns[i].cor===corAntes){ pat=patterns[i]; break; } }
      if(pat && pat.taxa>=60){
        currentSignal = {
          id: Date.now(),
          entry: corAntes,
          color: corAntes==='HOME'?'VERMELHO':'AZUL',
          time: new Date().toLocaleTimeString('pt-BR'),
          pattern: corAntes+' antes do TIE volta apos pular 2 - '+pat.taxa.toFixed(0)+'% ('+pat.acertos+'/'+pat.tentativas+')',
          taxa: pat.taxa,
          gales:0,
          maxGales:2,
          attempts:0
        };
        const copy = {};
        for(let k in currentSignal) copy[k]=currentSignal[k];
        copy.status='WAITING';
        signals.unshift(copy);
        saveSignals();
        aiState='SINAL ENCONTRADO '+corAntes+' '+pat.taxa.toFixed(0)+'%';
        return;
      }
    }
  }
  aiState='AGUARDANDO Melhor: '+best.cor+' '+best.taxa.toFixed(0)+'%';
}

function checkSignals(newWinner){
  if(signals.length===0) return;
  for(let i=0;i<signals.length;i++){
    const s=signals[i];
    if(s.status==='WAITING'){
      s.attempts = (s.attempts||0)+1;
      if(newWinner===s.entry || newWinner==='TIE'){
        s.status='GREEN';
        s.result=newWinner;
        greens++;
        if(currentSignal && currentSignal.id===s.id) currentSignal=null;
        saveSignals();
        break;
      }else{
        if(s.gales < s.maxGales){
          s.gales++;
        }else{
          s.status='RED';
          s.result=newWinner;
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

  let sinalHtml='';
  if(currentSignal){
    const col = currentSignal.entry==='HOME'?'#ef4444':'#3b82f6';
    sinalHtml='<div style="background:rgba(16,185,129,0.1);border:2px solid '+col+';border-radius:16px;padding:20px;text-align:center"><div style="font-size:10px;color:#6b7280">PADRAO DETECTADO - IA PULA 2</div><div style="font-size:12px;color:#9ca3af;margin:8px 0">'+currentSignal.pattern+'</div><div style="font-size:28px;font-weight:900;color:'+col+'">ENTRA '+currentSignal.color+'</div><div style="font-size:13px;background:rgba(255,255,255,0.1);display:inline-block;padding:6px 16px;border-radius:20px;margin-top:8px">COBRIR EMPATE - '+currentSignal.time+' G'+currentSignal.gales+'</div><div style="margin-top:8px;font-size:11px;color:#10b981">IA '+currentSignal.taxa.toFixed(0)+'% confianca - G2 1-2-4</div></div>';
  }else{
    sinalHtml='<div style="text-align:center;padding:30px"><div style="font-size:36px">AI</div><div style="font-weight:800;margin-top:10px">AGUARDANDO</div><div style="font-size:11px;color:#6b7280;margin-top:6px">'+aiState+'</div><div style="font-size:10px;color:#eab308;margin-top:12px">ESCANEANDO PADROES PULA 2 EM TEMPO REAL - G2</div></div>';
  }

  let bolasHtml='';
  for(let i=0;i<history.length;i++){
    const h=history[i];
    let bg='#1f2937', col='#9ca3af', border='#374151';
    if(h.winner==='HOME'){bg='rgba(239,68,68,0.15)'; col='#ef4444'; border='#ef4444';}
    if(h.winner==='AWAY'){bg='rgba(59,130,246,0.15)'; col='#3b82f6'; border='#3b82f6';}
    if(h.winner==='TIE'){bg='rgba(234,179,8,0.15)'; col='#eab308'; border='#eab308';}
    bolasHtml+='<div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;border:2px solid '+border+';background:'+bg+';color:'+col+'">'+h.winner[0]+'</div>';
  }
  if(!bolasHtml) bolasHtml='<div style="color:#6b7280;padding:20px">Conectando ao Joker... '+botStatus+'</div>';

  let sinaisHtml='';
  const ultimos=signals.slice(0,10);
  for(let i=0;i<ultimos.length;i++){
    const s=ultimos[i];
    const border = s.status==='GREEN'?'#10b981':s.status==='RED'?'#ef4444':'#eab308';
    const bg = s.entry==='HOME'?'rgba(239,68,68,0.15)':'rgba(59,130,246,0.15)';
    const col = s.entry==='HOME'?'#ef4444':'#3b82f6';
    const statusBg = s.status==='GREEN'?'rgba(16,185,129,0.2)':s.status==='RED'?'rgba(239,68,68,0.2)':'rgba(234,179,8,0.2)';
    const statusCol = s.status==='GREEN'?'#10b981':s.status==='RED'?'#ef4444':'#eab308';
    sinaisHtml+='<div style="background:#111827;border-left:4px solid '+border+';border-radius:12px;padding:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:50%;background:'+bg+';color:'+col+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px">'+s.entry[0]+'</div><div><div style="font-size:12px;font-weight:700">ENTRA '+s.entry+' COBRIR EMPATE</div><div style="font-size:10px;color:#6b7280">'+s.time+' - '+(s.pattern||'')+'</div></div></div><div style="text-align:right"><div style="font-size:11px;background:'+statusBg+';color:'+statusCol+';padding:4px 10px;border-radius:20px;font-weight:700">'+s.status+' '+(s.gales?'G'+s.gales:'')+'</div><div style="font-size:10px;color:#6b7280;margin-top:4px">'+(s.result||'Aguardando...')+'</div></div></div>';
  }
  if(!sinaisHtml) sinaisHtml='<div style="text-align:center;padding:20px;color:#6b7280">IA aguardando padroes... Pula 2 casas - G2 1-2-4 - '+aiState+'</div>';

  let html='';
  html+='<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  html+='<title>Vander 400 IA G2 FIX</title>';
  html+='<style>body{background:#03050a;color:#e2e8f0;font-family:system-ui;padding:12px;margin:0} .glass{background:rgba(12,16,28,0.9);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:16px;margin-bottom:12px}</style>';
  html+='</head><body>';
  html+='<div style="max-width:1100px;margin:0 auto">';
  html+='<div class="glass" style="display:flex;justify-content:space-between;align-items:center"><div><h1 style="font-size:18px;font-weight:900;margin:0">VANDER PLACAR 400 - IA G2 - FIX FINAL</h1><p style="font-size:11px;color:#6b7280;margin:4px 0 0 0">'+botStatus+' - '+aiState+'</p></div><div style="text-align:right"><div style="color:#10b981;font-size:11px">IA VIVA PULA 2 G2 1-2-4</div><div style="font-size:10px;color:#6b7280;margin-top:4px"><a href="/api/clear" style="color:#10b981">Limpar</a> | <a href="/api/raw" style="color:#10b981">RAW</a> | <a href="/api/debug" style="color:#10b981">DEBUG</a></div></div></div>';
  html+='<div class="glass"><h3 style="font-size:12px;font-weight:800;margin:0 0 12px 0">SINAIS - IA CONSCIENTE - PULA 2 - G2 1-2-4</h3>'+sinalHtml+'<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:12px"><div class="glass" style="text-align:center;margin:0"><div style="font-size:10px;color:#6b7280">HOJE</div><div style="font-size:13px"><span style="color:#10b981">'+greens+' W</span> <span style="color:#ef4444">'+reds+' R</span></div></div><div class="glass" style="text-align:center;margin:0"><div style="font-size:10px;color:#6b7280">ASSERTIVIDADE G2</div><div style="font-size:16px;font-weight:800;color:#10b981">'+assertividade+'% - '+(greens+reds)+' sinais</div><div style="font-size:10px;color:#6b7280">G0 54.9% G1 77.2% G2 87.5%</div></div></div></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px"><div class="glass" style="text-align:center;margin:0"><div style="font-size:10px;color:#6b7280">TOTAL</div><div style="font-size:22px;font-weight:800">'+total+'/400</div><div style="font-size:10px;color:#6b7280">'+botStatus+'</div></div><div class="glass" style="text-align:center;margin:0"><div style="font-size:10px;color:#ef4444">HOME</div><div style="font-size:18px;font-weight:800;color:#ef4444">'+stats.HOME+' <span style="font-size:11px;color:#6b7280">'+homePct+'%</span></div></div><div class="glass" style="text-align:center;margin:0"><div style="font-size:10px;color:#3b82f6">AWAY</div><div style="font-size:18px;font-weight:800;color:#3b82f6">'+stats.AWAY+' <span style="font-size:11px;color:#6b7280">'+awayPct+'%</span></div></div><div class="glass" style="text-align:center;margin:0"><div style="font-size:10px;color:#eab308">TIE</div><div style="font-size:18px;font-weight:800;color:#eab308">'+stats.TIE+' <span style="font-size:11px;color:#6b7280">'+tiePct+'%</span></div></div></div>';
  html+='<div class="glass"><h3 style="font-size:11px;color:#6b7280;margin:0 0 10px 0">PLACAR GRANDE - 400 - ANOTANDO CORES - IA PULA 2 - G2</h3><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:100px">'+bolasHtml+'</div></div>';
  html+='<div class="glass"><h3 style="font-size:12px;font-weight:800;margin:0 0 10px 0">ULTIMOS SINAIS - IA - G2 1-2-4 - PULA 2</h3><div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">'+sinaisHtml+'</div></div>';
  html+='</div>';
  html+='</body></html>';
  return html;
}

const server = http.createServer(function(req,res){
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
    try{ fs.unlinkSync('./history.json'); fs.unlinkSync('./signals.json'); fs.unlinkSync('./token.json'); }catch(e){}
    history=[]; stats={HOME:0,AWAY:0,TIE:0}; signals=[]; currentSignal=null; greens=0; reds=0;
    fetchReal().then(function(){
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({success:true,msg:'limpo'}));
    });
    return;
  }
  if(url.pathname==='/api/raw'){
    let headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
    fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=20',{headers:headers}).then(function(r){
      if(!r.ok && r.status===401){
        return refreshTokenAuto().then(function(){
          headers={'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,'Content-Type':'application/json'};
          return fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=20',{headers:headers});
        });
      }
      return r;
    }).then(function(r){ return r.json(); }).then(function(data){
      let distinct={};
      for(let i=0;i<data.length;i++){
        const raw=data[i].winner || data[i].result || data[i].outcome || data[i].winning_side || 'NULL';
        distinct[raw]=(distinct[raw]||0)+1;
      }
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({count:data.length, distinct:distinct, sample:data.slice(0,3), columns:data[0]?Object.keys(data[0]):[]}, null, 2));
    }).catch(function(e){
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:e.message}));
    });
    return;
  }
  if(url.pathname==='/api/debug'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stri
