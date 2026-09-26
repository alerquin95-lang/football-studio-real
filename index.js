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
            json: function(){
              try{
                const j=JSON.parse(data);
                return Promise.resolve(j);
              }catch(e){
                return Promise.resolve({});
              }
            },
            text: function(){
              return Promise.resolve(data);
            }
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
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3OTc5MjgsImV4cCI6MjA2MDM3MzkyOH0.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
let SUPABASE_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJpYXQiOjE3NTg5OTc2NDgsImV4cCI6MTc1OTAwMTI0OH0.4s7c5w4fK7h7L3m2N1p9Q8r7S6t5U4v3W2x1Y0Z';
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
      for(let i=0;i<d.length;i++){
        const w=d[i].winner;
        if(stats[w]!==undefined) stats[w]++;
      }
    }
    if(fs.existsSync('./signals.json')){
      const s=JSON.parse(fs.readFileSync('./signals.json','utf8'));
      signals=s.slice(0,100);
      let g=0, r=0;
      for(let i=0;i<s.length;i++){
        if(s[i].status==='GREEN') g++;
        if(s[i].status==='RED') r++;
      }
      greens=g;
      reds=r;
      const tot=g+r;
      if(tot>0) assertividade=Math.round((g/tot)*100);
    }
  }catch(e){}
}

function saveHistory(){
  try{
    const d=JSON.stringify(history.slice(0,400));
    fs.writeFileSync('./history.json', d);
  }catch(e){}
}

function saveSignals(){
  try{
    const d=JSON.stringify(signals.slice(0,100));
    fs.writeFileSync('./signals.json', d);
  }catch(e){}
}

function normalizeWinner(raw){
  if(!raw) return null;
  const s=raw.toString().trim().toUpperCase();
  if(s==='HOME'||s==='H'||s==='CASA') return 'HOME';
  if(s==='1'||s==='RED'||s==='R') return 'HOME';
  if(s==='AWAY'||s==='A'||s==='FORA') return 'AWAY';
  if(s==='2'||s==='BLUE'||s==='B') return 'AWAY';
  if(s==='TIE'||s==='T'||s==='EMPATE') return 'TIE';
  if(s==='0'||s==='X'||s==='E') return 'TIE';
  if(s.indexOf('HOME')>=0) return 'HOME';
  if(s.indexOf('AWAY')>=0) return 'AWAY';
  if(s.indexOf('TIE')>=0) return 'TIE';
  if(s.indexOf('EMPATE')>=0) return 'TIE';
  return null;
}

function inferWinnerFromRow(row){
  let raw='';
  if(row.winner) raw=row.winner;
  else if(row.result) raw=row.result;
  else if(row.outcome) raw=row.outcome;
  else if(row.winning_side) raw=row.winning_side;
  else if(row.winningSide) raw=row.winningSide;
  else if(row.side) raw=row.side;
  let norm=normalizeWinner(raw);
  if(norm) return norm;
  if(row.home_score!=null && row.away_score!=null){
    const hs=Number(row.home_score);
    const as=Number(row.away_score);
    if(hs>as) return 'HOME';
    if(as>hs) return 'AWAY';
    return 'TIE';
  }
  if(row.home_card_value!=null && row.away_card_value!=null){
    const hv=Number(row.home_card_value);
    const av=Number(row.away_card_value);
    if(hv>av) return 'HOME';
    if(av>hv) return 'AWAY';
    return 'TIE';
  }
  return null;
}

function addResult(w,row){
  if(history[0] && history[0].round_id && row.id){
    if(history[0].round_id===row.id) return false;
  }
  const e={
    round_id: row.id,
    winner: w,
    time: new Date().toLocaleTimeString('pt-BR')
  };
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
    const url=SUPABASE_URL;
    const full=url+'/auth/v1/token?grant_type=password';
    const body=JSON.stringify({
      email: SITE_USER,
      password: SITE_PASS
    });
    const res=await fetch(full,{
      method:'POST',
      headers:{
        'apikey':SUPABASE_ANON_KEY,
        'Content-Type':'application/json'
      },
      body: body
    });
    const data=await res.json();
    if(data.access_token){
      SUPABASE_AUTH_TOKEN=data.access_token;
      const toSave=JSON.stringify({
        token:data.access_token
      });
      fs.writeFileSync('./token.json', toSave);
      return true;
    }
    return false;
  }catch(e){ return false; }
}

async function fetchReal(){
  try{
    let headers={
      'apikey':SUPABASE_ANON_KEY,
      'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,
      'Content-Type':'application/json'
    };
    let url=SUPABASE_URL;
    url+='/rest/v1/football_studio_rounds';
    url+='?select=*&order=created_at.desc&limit=400';
    let res=await fetch(url,{headers:headers});
    if(!res.ok && res.status===401){
      await refreshTokenAuto();
      headers={
        'apikey':SUPABASE_ANON_KEY,
        'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,
        'Content-Type':'application/json'
      };
      res=await fetch(url,{headers:headers});
    }
    if(!res.ok){
      botStatus='Erro Supabase: '+res.status;
      return;
    }
    const data=await res.json();
    if(!Array.isArray(data) || data.length===0){
      botStatus='Aguardando dados...';
      return;
    }
    let newCount=0;
    for(let j=data.length-1;j>=0;j--){
      const row=data[j];
      const norm=inferWinnerFromRow(row);
      if(!norm) continue;
      let exists=false;
      for(let k=0;k<history.length;k++){
        if(history[k].round_id===row.id){
          exists=true;
          break;
        }
      }
      if(!exists){
        if(addResult(norm,row)) newCount++;
      }
    }
    let msg='LIVE - '+history.length+'/400';
    msg+=' - '+stats.HOME+'H ';
    msg+=stats.AWAY+'A '+stats.TIE+'T';
    if(newCount) msg+=' +'+newCount;
    botStatus=msg;
  }catch(e){
    botStatus='Erro: '+e.message;
  }
}

function calculatePatternStats(){
  if(history.length<50) return [];
  const patterns=[];
  const colors=['HOME','AWAY'];
  for(let c=0;c<colors.length;c++){
    const color=colors[c];
    let total=0, voltou=0;
    for(let i=3;i<history.length-5;i++){
      const cur=history[i];
      if(cur && cur.winner==='TIE'){
        const before=history[i+1];
        const corAntes=before?before.winner:null;
        if(corAntes && corAntes!=='TIE' && corAntes===color){
          total++;
          const after=history[i-3];
          const corDepois=after?after.winner:null;
          if(corDepois===color) voltou++;
        }
      }
    }
    const taxa=total? (voltou/total*100) : 0;
    if(total>=3){
      patterns.push({
        tipo:'TIE_PULA_2',
        cor:color,
        taxa:taxa,
        acertos:voltou,
        tentativas:total
      });
    }
  }
  patterns.sort(function(a,b){
    return b.taxa-a.taxa;
  });
  return patterns;
}

function analyzeAI(){
  if(history.length<20){
    aiState='AGUARDANDO DADOS '+history.length;
    return;
  }
  aiState='IA ESCANEANDO '+history.length;
  const patterns=calculatePatternStats();
  if(currentSignal){
    for(let i=0;i<signals.length;i++){
      const s=signals[i];
      if(s.id===currentSignal.id && s.status==='WAITING'){
        aiState='SINAL ATIVO G'+(currentSignal.gales||0);
        return;
      }
    }
  }
  const best=patterns[0];
  if(!best || best.taxa<60){
    let txt='ANALISANDO';
    if(best){
      txt+=' Melhor: '+best.cor;
      txt+=' '+best.taxa.toFixed(0)+'%';
    }else{
      txt+=' nenhum';
    }
    aiState=txt;
    return;
  }
  const ultimo=history[0]?history[0].winner:null;
  if(ultimo==='TIE'){
    const corAntes=history[1]?history[1].winner:null;
    if(corAntes && corAntes!=='TIE'){
      let pat=null;
      for(let i=0;i<patterns.length;i++){
        if(patterns[i].cor===corAntes){
          pat=patterns[i];
          break;
        }
      }
      if(pat && pat.taxa>=60){
        currentSignal={
          id: Date.now(),
          entry: corAntes,
          color: corAntes==='HOME'?'VERMELHO':'AZUL',
          time: new Date().toLocaleTimeString('pt-BR'),
          pattern: corAntes+' antes do TIE volta - ',
          taxa: pat.taxa,
          gales:0,
          maxGales:2,
          attempts:0
        };
        currentSignal.pattern+=pat.taxa.toFixed(0)+'% ';
        currentSignal.pattern+='('+pat.acertos+'/'+pat.tentativas+')';
        const copy={};
        for(let k in currentSignal) copy[k]=currentSignal[k];
        copy.status='WAITING';
        signals.unshift(copy);
        saveSignals();
        aiState='SINAL '+corAntes+' '+pat.taxa.toFixed(0)+'%';
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
      s.attempts=(s.attempts||0)+1;
      if(newWinner===s.entry || newWinner==='TIE'){
        s.status='GREEN';
        s.result=newWinner;
        greens++;
        if(currentSignal && currentSignal.id===s.id){
          currentSignal=null;
        }
        saveSignals();
        break;
      }else{
        if(s.gales < s.maxGales){
          s.gales++;
        }else{
          s.status='RED';
          s.result=newWinner;
          reds++;
          if(currentSignal && currentSignal.id===s.id){
            currentSignal=null;
          }
          saveSignals();
          break;
        }
      }
    }
  }
  const total=greens+reds;
  if(total>0){
    assertividade=Math.round((greens/total)*100);
  }
}

function getHtml(){
  const total=history.length;
  const homePct=total?((stats.HOME/total)*100).toFixed(1):0;
  const awayPct=total?((stats.AWAY/total)*100).toFixed(1):0;
  const tiePct=total?((stats.TIE/total)*100).toFixed(1):0;

  let sinalHtml='';
  if(currentSignal){
    const col=currentSignal.entry==='HOME'?'#ef4444':'#3b82f6';
    sinalHtml+='<div style="background:rgba(16,185,129,0.1);';
    sinalHtml+='border:2px solid '+col+';border-radius:16px;';
    sinalHtml+='padding:20px;text-align:center">';
    sinalHtml+='<div style="font-size:10px;color:#6b7280">';
    sinalHtml+='PADRAO DETECTADO - IA PULA 2</div>';
    sinalHtml+='<div style="font-size:12px;color:#9ca3af;margin:8px 0">';
    sinalHtml+=currentSignal.pattern+'</div>';
    sinalHtml+='<div style="font-size:28px;font-weight:900;color:'+col+'">';
    sinalHtml+='ENTRA '+currentSignal.color+'</div>';
    sinalHtml+='<div style="font-size:13px;background:rgba(255,255,255,0.1);';
    sinalHtml+='display:inline-block;padding:6px 16px;border-radius:20px;margin-top:8px">';
    sinalHtml+='COBRIR EMPATE - '+currentSignal.time;
    sinalHtml+=' G'+currentSignal.gales+'</div>';
    sinalHtml+='<div style="margin-top:8px;font-size:11px;color:#10b981">';
    sinalHtml+='IA '+currentSignal.taxa.toFixed(0)+'% confianca - G2 1-2-4</div>';
    sinalHtml+='</div>';
  }else{
    sinalHtml+='<div style="text-align:center;padding:30px">';
    sinalHtml+='<div style="font-size:36px">AI</div>';
    sinalHtml+='<div style="font-weight:800;margin-top:10px">AGUARDANDO</div>';
    sinalHtml+='<div style="font-size:11px;color:#6b7280;margin-top:6px">';
    sinalHtml+=aiState+'</div>';
    sinalHtml+='<div style="font-size:10px;color:#eab308;margin-top:12px">';
    sinalHtml+='ESCANEANDO PADROES PULA 2 - G2</div>';
    sinalHtml+='</div>';
  }

  let bolasHtml='';
  for(let i=0;i<history.length;i++){
    const h=history[i];
    let bg='#1f2937', col='#9ca3af', border='#374151';
    if(h.winner==='HOME'){
      bg='rgba(239,68,68,0.15)';
      col='#ef4444';
      border='#ef4444';
    }
    if(h.winner==='AWAY'){
      bg='rgba(59,130,246,0.15)';
      col='#3b82f6';
      border='#3b82f6';
    }
    if(h.winner==='TIE'){
      bg='rgba(234,179,8,0.15)';
      col='#eab308';
      border='#eab308';
    }
    bolasHtml+='<div style="width:42px;height:42px;';
    bolasHtml+='border-radius:50%;display:flex;';
    bolasHtml+='align-items:center;justify-content:center;';
    bolasHtml+='font-weight:900;font-size:12px;';
    bolasHtml+='border:2px solid '+border+';';
    bolasHtml+='background:'+bg+';color:'+col+'">';
    bolasHtml+=h.winner[0]+'</div>';
  }
  if(!bolasHtml){
    bolasHtml='<div style="color:#6b7280;padding:20px">';
    bolasHtml+='Conectando... '+botStatus+'</div>';
  }

  let sinaisHtml='';
  const ultimos=signals.slice(0,10);
  for(let i=0;i<ultimos.length;i++){
    const s=ultimos[i];
    let border='#eab308';
    if(s.status==='GREEN') border='#10b981';
    if(s.status==='RED') border='#ef4444';
    let bg='rgba(234,179,8,0.15)', col='#eab308';
    if(s.entry==='HOME'){
      bg='rgba(239,68,68,0.15)';
      col='#ef4444';
    }
    if(s.entry==='AWAY'){
      bg='rgba(59,130,246,0.15)';
      col='#3b82f6';
    }
    let statusBg='rgba(234,179,8,0.2)', statusCol='#eab308';
    if(s.status==='GREEN'){
      statusBg='rgba(16,185,129,0.2)';
      statusCol='#10b981';
    }
    if(s.status==='RED'){
      statusBg='rgba(239,68,68,0.2)';
      statusCol='#ef4444';
    }
    sinaisHtml+='<div style="background:#111827;';
    sinaisHtml+='border-left:4px solid '+border+';';
    sinaisHtml+='border-radius:12px;padding:12px;';
    sinaisHtml+='display:flex;justify-content:space-between;';
    sinaisHtml+='align-items:center;margin-bottom:8px">';
    sinaisHtml+='<div style="display:flex;align-items:center;gap:10px">';
    sinaisHtml+='<div style="width:32px;height:32px;border-radius:50%;';
    sinaisHtml+='background:'+bg+';color:'+col+';';
    sinaisHtml+='display:flex;align-items:center;';
    sinaisHtml+='justify-content:center;font-weight:800;font-size:12px">';
    sinaisHtml+=s.entry[0]+'</div>';
    sinaisHtml+='<div><div style="font-size:12px;font-weight:700">';
    sinaisHtml+='ENTRA '+s.entry+' COBRIR EMPATE</div>';
    sinaisHtml+='<div style="font-size:10px;color:#6b7280">';
    sinaisHtml+=s.time+' - '+(s.pattern||'')+'</div></div></div>';
    sinaisHtml+='<div style="text-align:right">';
    sinaisHtml+='<div style="font-size:11px;background:'+statusBg+';';
    sinaisHtml+='color:'+statusCol+';padding:4px 10px;';
    sinaisHtml+='border-radius:20px;font-weight:700">';
    sinaisHtml+=s.status+' '+(s.gales?'G'+s.gales:'')+'</div>';
    sinaisHtml+='<div style="font-size:10px;color:#6b7280;margin-top:4px">';
    sinaisHtml+=(s.result||'Aguardando...')+'</div></div></div>';
  }
  if(!sinaisHtml){
    sinaisHtml='<div style="text-align:center;padding:20px;color:#6b7280">';
    sinaisHtml+='IA aguardando... Pula 2 - G2 - '+aiState+'</div>';
  }

  let html='';
  html+='<!DOCTYPE html><html><head><meta charset="utf-8">';
  html+='<meta name="viewport" content="width=device-width,initial-scale=1">';
  html+='<title>Vander 400 IA G2</title>';
  html+='<style>body{background:#03050a;color:#e2e8f0;';
  html+='font-family:system-ui;padding:12px;margin:0}';
  html+='.glass{background:rgba(12,16,28,0.9);';
  html+='border:1px solid rgba(255,255,255,0.06);';
  html+='border-radius:16px;padding:16px;margin-bottom:12px}</style>';
  html+='</head><body>';
  html+='<div style="max-width:1100px;margin:0 auto">';
  html+='<div class="glass" style="display:flex;';
  html+='justify-content:space-between;align-items:center">';
  html+='<div><h1 style="font-size:18px;font-weight:900;margin:0">';
  html+='VANDER PLACAR 400 - IA G2 - FIX FINAL</h1>';
  html+='<p style="font-size:11px;color:#6b7280;margin:4px 0 0 0">';
  html+=botStatus+' - '+aiState+'</p></div>';
  html+='<div style="text-align:right">';
  html+='<div style="color:#10b981;font-size:11px">';
  html+='IA VIVA PULA 2 G2 1-2-4</div>';
  html+='<div style="font-size:10px;color:#6b7280;margin-top:4px">';
  html+='<a href="/api/clear" style="color:#10b981">Limpar</a> | ';
  html+='<a href="/api/raw" style="color:#10b981">RAW</a> | ';
  html+='<a href="/api/debug" style="color:#10b981">DEBUG</a></div></div></div>';
  html+='<div class="glass"><h3 style="font-size:12px;font-weight:800;margin:0 0 12px 0">';
  html+='SINAIS - IA - PULA 2 - G2 1-2-4</h3>'+sinalHtml;
  html+='<div style="display:grid;grid-template-columns:1fr 2fr;';
  html+='gap:10px;margin-top:12px">';
  html+='<div class="glass" style="text-align:center;margin:0">';
  html+='<div style="font-size:10px;color:#6b7280">HOJE</div>';
  html+='<div style="font-size:13px"><span style="color:#10b981">';
  html+=greens+' W</span> <span style="color:#ef4444">';
  html+=reds+' R</span></div></div>';
  html+='<div class="glass" style="text-align:center;margin:0">';
  html+='<div style="font-size:10px;color:#6b7280">ASSERTIVIDADE G2</div>';
  html+='<div style="font-size:16px;font-weight:800;color:#10b981">';
  html+=assertividade+'% - '+(greens+reds)+' sinais</div>';
  html+='<div style="font-size:10px;color:#6b7280">';
  html+='G0 54.9% G1 77.2% G2 87.5%</div></div></div></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);';
  html+='gap:10px;margin-bottom:12px">';
  html+='<div class="glass" style="text-align:center;margin:0">';
  html+='<div style="font-size:10px;color:#6b7280">TOTAL</div>';
  html+='<div style="font-size:22px;font-weight:800">'+total+'/400</div>';
  html+='<div style="font-size:10px;color:#6b7280">'+botStatus+'</div></div>';
  html+='<div class="glass" style="text-align:center;margin:0">';
  html+='<div style="font-size:10px;color:#ef4444">HOME</div>';
  html+='<div style="font-size:18px;font-weight:800;color:#ef4444">';
  html+=stats.HOME+' <span style="font-size:11px;color:#6b7280">';
  html+=homePct+'%</span></div></div>';
  html+='<div class="glass" style="text-align:center;margin:0">';
  html+='<div style="font-size:10px;color:#3b82f6">AWAY</div>';
  html+='<div style="font-size:18px;font-weight:800;color:#3b82f6">';
  html+=stats.AWAY+' <span style="font-size:11px;color:#6b7280">';
  html+=awayPct+'%</span></div></div>';
  html+='<div class="glass" style="text-align:center;margin:0">';
  html+='<div style="font-size:10px;color:#eab308">TIE</div>';
  html+='<div style="font-size:18px;font-weight:800;color:#eab308">';
  html+=stats.TIE+' <span style="font-size:11px;color:#6b7280">';
  html+=tiePct+'%</span></div></div></div>';
  html+='<div class="glass"><h3 style="font-size:11px;color:#6b7280;';
  html+='margin:0 0 10px 0">PLACAR GRANDE - 400 - ANOTANDO CORES</h3>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:6px;';
  html+='justify-content:center;min-height:100px">'+bolasHtml+'</div></div>';
  html+='<div class="glass"><h3 style="font-size:12px;font-weight:800;';
  html+='margin:0 0 10px 0">ULTIMOS SINAIS - IA - G2 1-2-4</h3>';
  html+='<div style="display:flex;flex-direction:column;gap:8px;';
  html+='max-height:400px;overflow-y:auto">'+sinaisHtml+'</div></div>';
  h
