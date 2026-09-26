import http from 'http';
import fs from 'fs';

const SUPABASE_URL = 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const A0='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI';
const A1='sInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJ';
const A2='pYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt';
const A3='8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
const SUPABASE_ANON_KEY=A0+A1+A2+A3;

const B0='eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIx';
const B1='LTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3V';
const B2='senZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWI';
const B3='iOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQ';
const B4='iOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwNDI5NTAwLCJpYXQiOjE3OTA';
const B5='0MjU5MDAsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInB';
const B6='ob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJ';
const B7='wcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWw';
const B8='iOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQ';
const B9='iOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJ';
const B10='vc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2N';
const B11='vZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9';
const B12='jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY';
const B13='0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWF';
const B14='sMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE';
const B15='3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1';
const B16='iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.TJef0Q';
const B17='dVhjkcaEiEKci95bARRFPUlkqwlWKQfsYNuqkjK5ge4FGzjpCJx3RDv3JOxh';
const B18='yXGvB0-RcA8xAU__b6EA';
let SUPABASE_AUTH_TOKEN=B0+B1+B2+B3+B4+B5+B6+B7+B8+B9+B10+B11+B12+B13+B14+B15+B16+B17+B18;

const SITE_USER='santarosavander@gmail.com';
const SITE_PASS='131619jV*';

let history=[];
let stats={HOME:0,AWAY:0,TIE:0};
let botStatus='Conectando ao Joker...';
let lastError='';
let signals=[];
let greens=0;
let reds=0;
let assertividade=0;
let aiState='INICIANDO';
let currentSignal=null;

function loadHistory(){
  try{
    if(fs.existsSync('./token.json')){
      const tj=JSON.parse(fs.readFileSync('./token.json','utf8'));
      if(tj.token) SUPABASE_AUTH_TOKEN=tj.token;
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
      let g=0,r=0;
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
    const data=JSON.stringify(history.slice(0,400));
    fs.writeFileSync('./history.json', data);
  }catch(e){}
}

function saveSignals(){
  try{
    const data=JSON.stringify(signals.slice(0,100));
    fs.writeFileSync('./signals.json', data);
  }catch(e){}
}

function normalizeWinner(raw){
  const s=(raw||'').toString().trim().toUpperCase();
  if(['HOME','H','CASA','1','RED','R'].includes(s)) return 'HOME';
  if(['AWAY','A','FORA','2','BLUE','B'].includes(s)) return 'AWAY';
  if(['TIE','T','EMPATE','0','X','E','YELLOW'].includes(s)) return 'TIE';
  if(s.includes('HOME')) return 'HOME';
  if(s.includes('AWAY')) return 'AWAY';
  if(s.includes('TIE')) return 'TIE';
  return null;
}

function inferWinnerFromRow(row){
  let raw=row.winner||row.result||row.outcome;
  raw=raw||row.winning_side||row.side||'';
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
        cor:color,
        taxa:taxa,
        acertos:voltou,
        tentativas:total
      });
    }
  }
  patterns.sort(function(a,b){return b.taxa-a.taxa;});
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
          taxa: pat.taxa,
          acertos: pat.acertos,
          tentativas: pat.tentativas,
          gales:0,
          maxGales:2,
          attempts:0
        };
        const copy={};
        for(let k in currentSignal) copy[k]=currentSignal[k];
        copy.status='WAITING';
        copy.pattern=corAntes+' antes do TIE volta apos pular 2 - ';
        copy.pattern+=pat.taxa.toFixed(0)+'% ';
        copy.pattern+='('+pat.acertos+'/'+pat.tentativas+')';
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

function addResult(w,row){
  if(history[0]?.round_id && row?.id){
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
    const url=SUPABASE_URL+'/auth/v1/token?grant_type=password';
    const body=JSON.stringify({
      email:SITE_USER,
      password:SITE_PASS
    });
    const res=await fetch(url,{
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
      const toSave=JSON.stringify({token:data.access_token});
      fs.writeFileSync('./token.json', toSave);
      botStatus='Token renovado';
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
    let res=await fetch(url,{headers});
    if(!res.ok && res.status===401){
      await refreshTokenAuto();
      headers={
        'apikey':SUPABASE_ANON_KEY,
        'Authorization':'Bearer '+SUPABASE_AUTH_TOKEN,
        'Content-Type':'application/json'
      };
      res=await fetch(url,{headers});
    }
    if(!res.ok){
      lastError=await res.text();
      botStatus='Erro: '+res.status;
      return;
    }
    const data=await res.json();
    if(!Array.isArray(data)) return;
    let newCount=0;
    let dbg={HOME:0,AWAY:0,TIE:0};
    for(let j=data.length-1;j>=0;j--){
      const row=data[j];
      const norm=inferWinnerFromRow(row);
      if(!norm) continue;
      dbg[norm]++;
      let exists=false;
      for(let k=0;k<history.length;k++){
        if(history[k].round_id===row.id){exists=true;break;}
      }
      if(!exists){
        if(addResult(norm,row)) newCount++;
      }
    }
    let msg='LIVE - '+history.length+'/400';
    msg+=' - '+stats.HOME+'H '+stats.AWAY+'A '+stats.TIE+'T';
    msg+=' | DB:'+dbg.HOME+'H '+dbg.AWAY+'A '+dbg.TIE+'T';
    if(newCount) msg+=' +'+newCount;
    botStatus=msg;
  }catch(e){
    lastError=e.message;
    botStatus='Erro: '+e.message;
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
    sinalHtml+='IA DETECTOU PADRAO PULA 2</div>';
    sinalHtml+='<div style="font-size:12px;color:#9ca3af;margin:8px 0">';
    sinalHtml+=currentSignal.entry+' antes do TIE volta - ';
    sinalHtml+=currentSignal.taxa.toFixed(0)+'% ';
    sinalHtml+='('+currentSignal.acertos+'/'+currentSignal.tentativas+')</div>';
    sinalHtml+='<div style="font-size:28px;font-weight:900;color:'+col+'">';
    sinalHtml+='ENTRA '+currentSignal.color+'</div>';
    sinalHtml+='<div style="font-size:13px;background:rgba(255,255,255,0.1);';
    sinalHtml+='display:inline-block;padding:6px 16px;';
    sinalHtml+='border-radius:20px;margin-top:8px">';
    sinalHtml+='COBRIR EMPATE - '+currentSignal.time;
    sinalHtml+=' G'+currentSignal.gales+'</div>';
    sinalHtml+='<div style="margin-top:8px;font-size:11px;color:#10b981">';
    sinalHtml+='IA '+currentSignal.taxa.toFixed(0)+'% - G2 1-2-4</div>';
    sinalHtml+='</div>';
  }else{
    sinalHtml+='<div style="text-align:center;padding:24px">';
    sinalHtml+='<div style="font-size:32px">AI</div>';
    sinalHtml+='<div style="font-weight:800;margin-top:8px">AGUARDANDO</div>';
    sinalHtml+='<div style="font-size:11px;color:#6b7280;margin-top:6px">';
    sinalHtml+=aiState+'</div>';
    sinalHtml+='<div style="font-size:10px;color:#eab308;margin-top:10px">';
    sinalHtml+='IA ESCANEANDO PULA 2 - G2 1-2-4</div>';
    sinalHtml+='</div>';
  }

  let bolas='';
  for(let i=0;i<history.length;i++){
    const h=history[i];
    let cls='tie', col='#eab308', bg='rgba(234,179,8,0.15)';
    if(h.winner==='HOME'){
      cls='home';
      col='#ef4444';
      bg='rgba(239,68,68,0.15)';
    }
    if(h.winner==='AWAY'){
      cls='away';
      col='#3b82f6';
      bg='rgba(59,130,246,0.15)';
    }
    bolas+='<div class="ball '+cls+'">'+h.winner[0]+'</div>';
  }

  let linhas='';
  for(let i=0;i<history.length;i++){
    const h=history[i];
    let col='#eab308';
    if(h.winner==='HOME') col='#ef4444';
    if(h.winner==='AWAY') col='#3b82f6';
    linhas+='<tr><td>#'+(total-i)+'</td>';
    linhas+='<td style="color:'+col+';font-weight:700">';
    linhas+=h.winner+'</td><td>'+h.time+'</td></tr>';
  }

  let sinaisLista='';
  const ultimos=signals.slice(0,10);
  for(let i=0;i<ultimos.length;i++){
    const s=ultimos[i];
    let border='#eab308';
    if(s.status==='GREEN') border='#10b981';
    if(s.status==='RED') border='#ef4444';
    let bg='#eab308';
    if(s.entry==='HOME') bg='#ef4444';
    if(s.entry==='AWAY') bg='#3b82f6';
    sinaisLista+='<div style="background:#111827;';
    sinaisLista+='border-left:4px solid '+border+';';
    sinaisLista+='border-radius:12px;padding:10px;';
    sinaisLista+='display:flex;justify-content:space-between;';
    sinaisLista+='align-items:center;margin-bottom:8px">';
    sinaisLista+='<div style="display:flex;align-items:center;gap:8px">';
    sinaisLista+='<div style="width:28px;height:28px;border-radius:50%;';
    sinaisLista+='background:'+bg+'20;color:'+bg+';';
    sinaisLista+='display:flex;align-items:center;';
    sinaisLista+='justify-content:center;font-weight:800;font-size:11px">';
    sinaisLista+=s.entry[0]+'</div>';
    sinaisLista+='<div><div style="font-size:11px;font-weight:700">';
    sinaisLista+='ENTRA '+s.entry+' COBRIR EMPATE</div>';
    sinaisLista+='<div style="font-size:9px;color:#6b7280">';
    sinaisLista+=s.time+' - '+(s.pattern||'')+'</div></div></div>';
    sinaisLista+='<div style="text-align:right">';
    sinaisLista+='<div style="font-size:10px;background:'+border+'20;';
    sinaisLista+='color:'+border+';padding:3px 8px;';
    sinaisLista+='border-radius:12px;font-weight:700">';
    sinaisLista+=s.status+' '+(s.gales?'G'+s.gales:'')+'</div>';
    sinaisLista+='<div style="font-size:9px;color:#6b7280;margin-top:2px">';
    sinaisLista+=(s.result||'Aguardando')+'</div></div></div>';
  }

  if(!sinaisLista){
    sinaisLista='<div style="text-align:center;padding:16px;color:#6b7280;font-size:11px">';
    sinaisLista+='IA aguardando padroes - '+aiState+'</div>';
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vander Placar 400 - IA G2</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
body{background:#060a14;color:#e2e8f0;font-family:system-ui;padding:12px}
.glass{background:rgba(17,24,39,0.9);border:1px solid rgba(255,255,255,0.06);
border-radius:16px;padding:16px}
.ball{width:38px;height:38px;border-radius:50%;display:flex;
align-items:center;justify-content:center;font-weight:800;
font-size:12px;border:2px solid}
.ball.home{color:#ef4444;border-color:#ef4444;background:rgba(239,68,68,0.15)}
.ball.away{color:#3b82f6;border-color:#3b82f6;background:rgba(59,130,246,0.15)}
.ball.tie{color:#eab308;border-color:#eab308;background:rgba(234,179,8,0.15)}
</style></head><body>
<div style="max-width:1100px;margin:0 auto">
<div class="glass" style="display:flex;justify-content:space-between;margin-bottom:12px">
<div><h1 style="font-size:22px;font-weight:900">VANDER <span style="color:#10b981">PLACAR</span> 400 - IA G2</h1>
<p style="font-size:11px;color:#6b7280">${botStatus} - ${aiState}</p></div>
<div style="text-align:right"><span style="color:#10b981;font-size:11px">● LIVE - IA PULA 2 - G2 1-2-4</span>
<div style="font-size:10px;color:#6b7280;margin-top:4px">
<a href="/api/clear" style="color:#10b981">Limpar</a> | 
<a href="/api/raw" style="color:#10b981">RAW</a> | 
<a href="/api/debug" style="color:#10b981">DEBUG</a></div></div></div>

<div class="glass" style="margin-bottom:12px">
<h3 style="font-size:12px;font-weight:800;margin-bottom:12px">SINAIS - IA CONSCIENTE PULA 2 - G2 1-2-4</h3>
${sinalHtml}
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px">
<div class="glass" style="text-align:center;margin:0"><div style="font-size:10px;color:#6b7280">HOJE</div>
<div style="font-size:13px"><span style="color:#10b981">${greens} W</span> <span style="color:#ef4444">${reds} R</span></div></div>
<div class="glass" style="text-align:center;margin:0;grid-column:span 2">
<div style="font-size:10px;color:#6b7280">ASSERTIVIDADE G2</div>
<div style="font-size:16px;font-weight:800;color:#10b981">${assertividade}% - ${greens+reds} sinais</div>
<div style="font-size:10px;color:#6b7280">G0 54.9% G1 77.2% G2 87.5% - Pula 2</div></div></div></div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
<div class="glass" style="text-align:center"><div style="font-size:10px;color:#6b7280">TOTAL</div>
<div style="font-size:28px;font-weight:800">${total}/400</div></div>
<div class="glass" style="text-align:center;border-left:2px solid #ef4444">
<div style="font-size:10px;color:#ef4444">HOME</div>
<div style="font-size:24px;font-weight:800;color:#ef4444">${stats.HOME||0} <span style="font-size:12px;color:#6b7280">${homePct}%</span></div></div>
<div class="glass" style="text-align:center;border-left:2px solid #3b82f6">
<div style="font-size:10px;color:#3b82f6">AWAY</div>
<div style="font-size:24px;font-weight:800;color:#3b82f6">${stats.AWAY||0} <span style="font-size:12px;color:#6b7280">${awayPct}%</span></div></div>
<div class="glass" style="text-align:center;border-left:2px solid #eab308">
<div style="font-size:10px;color:#eab308">TIE</div>
<div style="font-size:24px;font-weight:800;color:#eab308">${stats.TIE||0} <span style="font-size:12px;color:#6b7280">${tiePct}%</span></div></div>
</div>

<div class="glass" style="margin-bottom:12px">
<h3 style="font-size:11px;color:#6b7280;margin-bottom:10px">PLACAR GRANDE - 400 - REAL TIME - IA PULA 2 - G2 - ${botStatus}</h3>
<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">${bolas||'Aguardando...'}</div></div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
<div class="glass"><h3 style="font-size:11px;color:#6b7280;margin-bottom:10px">ULTIMOS SINAIS - IA G2 1-2-4</h3>
<div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">${sinaisLista}</div></div>
<div class="glass"><h3 style="font-size:11px;color:#6b7280;margin-bottom:10px">HISTORICO - 400 - ANOTANDO CORES</h3>
<table style="width:100%;font-size:13px"><thead><tr style="color:#6b7280;font-size:10px"><th>#</th><th>Resultado</th><th>Hora</th></tr></thead>
<tbody>${linhas||'<tr><td colspan=3 style="text-align:center;padding:20px;color:#6b7280">Conectando...</td></tr>'}</tbody></table></div>
</div>

</div>
<script>
async function load(){
  try{
    const [s,r]=await Promise.all([fetch('/api/stats').then(x=>x.json()), fetch('/api/rounds').then(x=>x.json())]);
  }catch(e){}
}
load(); setInterval(()=>location.reload(),15000);
</script>
</body></html>`;
}

const
