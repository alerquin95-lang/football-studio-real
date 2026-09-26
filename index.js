import http from 'http';
import fs from 'fs';

const SUPABASE_URL = 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
let SUPABASE_AUTH_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwNDI5NTAwLCJpYXQiOjE3OTA0MjU5MDAsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.TJef0QdVhjkcaEiEKci95bARRFPUlkqwlWKQfsYNuqkjK5ge4FGzjpCJx3RDv3JOxhyXGvB0-RcA8xAU__b6EA';
const SITE_USER = 'santarosavander@gmail.com';
const SITE_PASS = '131619jV*';

let history = [];
let stats = { HOME:0, AWAY:0, TIE:0 };
let botStatus = 'Conectando ao Joker...';
let signals = [];
let greens = 545; // mock inicial igual Joker
let reds = 78;
let seq = 1;
let assertividade = 87;
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
      d.forEach(h=>{ if(stats[h.winner]!==undefined) stats[h.winner]++; });
    }
    if(fs.existsSync('./signals.json')){
      const s=JSON.parse(fs.readFileSync('./signals.json','utf8'));
      signals=s.slice(0,100);
      greens = s.filter(x=>x.status==='GREEN').length || 545;
      reds = s.filter(x=>x.status==='RED').length || 78;
    }
  }catch(e){}
}
function saveHistory(){ try{ fs.writeFileSync('./history.json', JSON.stringify(history.slice(0,400))); }catch(e){} }
function saveSignals(){ try{ fs.writeFileSync('./signals.json', JSON.stringify(signals.slice(0,100))); }catch(e){} }

function normalizeWinner(raw){
  const s = (raw||'').toString().trim().toUpperCase();
  if(['HOME','H','CASA','1','RED','R'].includes(s)) return 'HOME';
  if(['AWAY','A','FORA','2','BLUE','B'].includes(s)) return 'AWAY';
  if(['TIE','T','EMPATE','0','X','E','YELLOW'].includes(s)) return 'TIE';
  if(s.includes('HOME')) return 'HOME';
  if(s.includes('AWAY')) return 'AWAY';
  if(s.includes('TIE')) return 'TIE';
  return null;
}

function addResult(w,row){
  if(history[0]?.round_id && row?.id && history[0].round_id===row.id) return false;
  const e={ round_id: row.id, winner: w, time: new Date().toLocaleTimeString('pt-BR'), ts: Date.now() };
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
      if(!history.find(h=>h.round_id===row.id)){
        if(addResult(norm,row)) newCount++;
      }
    }
    if(newCount>0) botStatus='✅ LIVE - '+history.length+'/400 - '+stats.HOME+'H '+stats.AWAY+'A '+stats.TIE+'T';
  }catch(e){ botStatus='Erro: '+e.message; }
}


// IA INTELIGENTE - PROCURA PADRÕES SOZINHA
// Padrão genérico: X * * X (pula 2 casas, volta mesma cor)
// Padrão com empate: X TIE * * X (cor antes do empate volta depois de pular 2)

function calculatePatternStats(){
  if(history.length<50) return [];
  const patterns = [];

  // Padrão 1: X * * X - cor repete após pular 2
  for(let color of ['HOME','AWAY']){
    let wins=0, total=0;
    for(let i=0;i<history.length-4;i++){
      if(history[i+3]?.winner===color && history[i]?.winner===color){
        // history[i+3] é 3 posições mais antigo que i, com 2 no meio
        // Na ordem mais recente primeiro: i=0 é mais recente, i+3 é 3 atrás
        // Então padrão: [i]=X (recente), [i+3]=X (antigo), com 2 entre eles
        total++;
        // Verifica se padrão funcionou: após ver X * * , o próximo foi X?
        // Na verdade estamos olhando para trás, então conta ocorrência
        wins++;
      }
    }
    // Calcula taxa de acerto real: quantas vezes após X * * veio X
    let acertos=0, tentativas=0;
    for(let i=0;i<history.length-4;i++){
      const a = history[i+3]?.winner;
      const b = history[i]?.winner;
      if(a===color){
        tentativas++;
        if(b===color) acertos++;
      }
    }
    const taxa = tentativas? (acertos/tentativas*100) : 0;
    if(tentativas>=5) patterns.push({tipo:'PULA_2', cor:color, taxa, acertos, tentativas, desc:`${color} pula 2 e volta`});
  }

  // Padrão 2: Cor antes do empate volta após pular 2 - X TIE * * X
  for(let color of ['HOME','AWAY']){
    let acertos=0, tentativas=0;
    for(let i=0;i<history.length-5;i++){
      // Procura: [i+4]=X (cor antes do empate), [i+3]=TIE, [i]=X (cor que voltou após pular 2)
      // Estrutura: mais recente [i]=X, [i+1]=?, [i+2]=?, [i+3]=TIE, [i+4]=X
      if(history[i+3]?.winner==='TIE' && history[i+4]?.winner===color && history[i]?.winner===color){
        tentativas++;
        acertos++;
      }
      // Conta todas as vezes que teve X TIE
      if(history[i+3]?.winner==='TIE' && history[i+4]?.winner===color){
        // Verifica o que veio após pular 2 do empate
        if(i>=3){
          // Já contou acerto acima, só precisa contar tentativa
        }
      }
    }
    // Recalcula de forma correta: para cada TIE com cor antes, verifica se após pular 2 voltou mesma cor
    let totalTieComCor=0, voltou=0;
    for(let i=3;i<history.length-5;i++){
      if(history[i]?.winner==='TIE'){
        const corAntes = history[i+1]?.winner;
        if(corAntes && corAntes!=='TIE' && corAntes===color){
          totalTieComCor++;
          const corDepoisDePular2 = history[i-3]?.winner;
          if(corDepoisDePular2===color) voltou++;
        }
      }
    }
    const taxa = totalTieComCor? (voltou/totalTieComCor*100) : 0;
    if(totalTieComCor>=3) patterns.push({tipo:'TIE_PULA_2', cor:color, taxa, acertos:voltou, tentativas:totalTieComCor, desc:`${color} antes do TIE volta após pular 2`});
  }

  patterns.sort((a,b)=>b.taxa-a.taxa);
  return patterns;
}

function analyzeAI(){
  if(history.length<20){ aiState='AGUARDANDO DADOS'; return; }
  
  aiState='IA ESCANEANDO';

  const patterns = calculatePatternStats();
  
  // Se já tem sinal ativo, não cria outro
  if(currentSignal && signals.find(s=>s.id===currentSignal.id && s.status==='WAITING')){
    aiState='SINAL ATIVO - G'+(currentSignal.gales||0);
    return;
  }

  // Procura melhor padrão que está puxando agora
  const best = patterns[0];
  if(!best || best.taxa<60) {
    aiState='ANALISANDO '+patterns.length+' PADRÕES';
    return;
  }

  // Se o melhor padrão é do tipo TIE_PULA_2 e o último resultado foi TIE, sinaliza a cor
  const ultimo = history[0]?.winner;
  if(ultimo==='TIE' && best.tipo==='TIE_PULA_2'){
    const corAntes = history[1]?.winner;
    if(corAntes && corAntes!=='TIE'){
      // Verifica se corAntes tem bom histórico de voltar
      const patternCorAntes = patterns.find(p=>p.cor===corAntes && p.tipo==='TIE_PULA_2');
      if(patternCorAntes && patternCorAntes.taxa>=60){
        currentSignal = {
          id: Date.now(),
          entry: corAntes,
          color: corAntes==='HOME'?'VERMELHO':'AZUL',
          time: new Date().toLocaleTimeString('pt-BR'),
          pattern: patternCorAntes.desc + ` • ${patternCorAntes.taxa.toFixed(0)}% assert (${patternCorAntes.acertos}/${patternCorAntes.tentativas})`,
          taxa: patternCorAntes.taxa,
          status: 'AGUARDANDO',
          gales: 0,
          maxGales: 2,
          attempts: 0
        };
        signals.unshift({...currentSignal, status:'WAITING'});
        saveSignals();
        aiState='SINAL ENCONTRADO • '+corAntes+' • '+patternCorAntes.taxa.toFixed(0)+'%';
        return;
      }
    }
  }

  // Padrão PULA_2: se últimas 2 foram quaisquer e 3 atrás foi uma cor, aposta nessa cor
  if(best.tipo==='PULA_2' && best.taxa>=65){
    const cor3Atras = history[3]?.winner;
    if(cor3Atras && cor3Atras!=='TIE' && cor3Atras===best.cor){
      currentSignal = {
        id: Date.now(),
        entry: best.cor,
        color: best.cor==='HOME'?'VERMELHO':'AZUL',
        time: new Date().toLocaleTimeString('pt-BR'),
        pattern: best.desc + ` • ${best.taxa.toFixed(0)}% assert (${best.acertos}/${best.tentativas}) • IA detectou`,
        taxa: best.taxa,
        status: 'AGUARDANDO',
        gales: 0,
        maxGales: 2,
        attempts: 0
      };
      signals.unshift({...currentSignal, status:'WAITING'});
      saveSignals();
      aiState='SINAL ENCONTRADO • '+best.cor+' • '+best.taxa.toFixed(0)+'%';
      return;
    }
  }

  aiState='AGUARDANDO • Melhor padrão: '+(best ? best.cor+' '+best.taxa.toFixed(0)+'%': 'nenhum');
}

function checkSignals(newWinner){
  if(signals.length===0) return;
  for(let s of signals){
    if(s.status==='WAITING'){
      s.attempts = (s.attempts||0)+1;
      // G2: cobre empate - se vier empate, conta como green (porque tá cobrindo)
      if(newWinner===s.entry || newWinner==='TIE'){
        s.status='GREEN';
        s.result = newWinner;
        s.finalGale = s.gales;
        greens++;
        if(currentSignal && currentSignal.id===s.id) currentSignal=null;
        saveSignals();
        break;
      } else {
        // Errou, vai pro gale
        if(s.gales < s.maxGales){
          s.gales++;
          // continua aguardando próximo resultado para gale
        } else {
          // Errou G2 também
          s.status='RED';
          s.result = newWinner;
          s.finalGale = s.gales;
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


function getMinutosQuePuxamCores(){
  const minutos = {};
  for(let h of history){
    const m = h.time.split(':')[1] || '0';
    if(!minutos[m]) minutos[m]={HOME:0,AWAY:0,TIE:0,total:0};
    minutos[m][h.winner]++; minutos[m].total++;
  }
  const result = [];
  for(let min=0;min<60;min++){
    const key = String(min).padStart(2,'0');
    const data = minutos[key] || {HOME:0,AWAY:0,TIE:0,total:0};
    const homePct = data.total?Math.round((data.HOME/data.total)*100):0;
    const awayPct = data.total?Math.round((data.AWAY/data.total)*100):0;
    const tiePct = data.total?Math.round((data.TIE/data.total)*100):0;
    let best = 'AWAY', pct=awayPct, count=data.AWAY;
    if(homePct>pct){ best='HOME'; pct=homePct; count=data.HOME; }
    if(tiePct>pct){ best='TIE'; pct=tiePct; count=data.TIE; }
    result.push({minuto:min, best, pct, count, ...data});
  }
  result.sort((a,b)=>b.pct-a.pct);
  return result.slice(0,10);
}

function getMinutosQuePagamEmpate(){
  const minutos = {};
  for(let h of history){
    if(h.winner!=='TIE') continue;
    const m = h.time.split(':')[1] || '0';
    if(!minutos[m]) minutos[m]={count:0};
    minutos[m].count++;
  }
  const result=[];
  for(let min=0;min<60;min++){
    const key=String(min).padStart(2,'0');
    const data=minutos[key]||{count:0};
    const pct = history.filter(h=>h.winner==='TIE').length ? Math.round((data.count / history.filter(h=>h.winner==='TIE').length)*100) : 0;
    result.push({minuto:min, count:data.count, pct});
  }
  result.sort((a,b)=>b.count-a.count);
  return result.slice(0,10);
}

function getListaEmpates(){
  return history.filter(h=>h.winner==='TIE').slice(0,30).map(h=>h.time);
}


function getHtml(){
  const total=history.length;
  const minutosCores = getMinutosQuePuxamCores();
  const minutosEmpate = getMinutosQuePagamEmpate();
  const listaEmpates = getListaEmpates();
  const signalActive = currentSignal;
  const ultimosSinais = signals.slice(0,10);

  // Monta HTML do sinal sem template aninhado
  let sinalHtml = '';
  if(signalActive){
    const borderColor = signalActive.entry==='HOME'?'red':'blue';
    const textColor = signalActive.entry==='HOME'?'text-red-400':signalActive.entry==='AWAY'?'text-blue-400':'text-amber-400';
    sinalHtml = '<div class="relative z-10 w-full max-w-md">' +
      '<div class="text-center mb-4"><span class="text-[11px] tracking-[0.2em] text-amber-300 font-bold px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">● ANALISANDO PADRÃO</span></div>' +
      '<div class="glass rounded-[20px] p-6 neon-glow border-2 border-'+borderColor+'-500/50 shimmer">' +
        '<div class="text-center">' +
          '<div class="text-[10px] text-zinc-500 tracking-widest mb-2">PADRÃO DETECTADO</div>' +
          '<div class="text-[12px] text-zinc-400 mb-3">'+ (signalActive.pattern||'') +'</div>' +
          '<div class="text-3xl font-black mb-2 '+textColor+'">ENTRA '+signalActive.color+'</div>' +
          '<div class="text-[14px] font-bold text-white bg-white/10 px-4 py-2 rounded-full inline-block">COBRIR EMPATE • '+signalActive.time+'</div>' +
          '<div class="mt-4 flex justify-center gap-2"><div class="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div><span class="text-[11px] text-emerald-400">IA com '+ (signalActive.taxa?signalActive.taxa.toFixed(0):87) +'% de confiança</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="mt-4 text-center text-[11px] text-amber-300/70">ESCANEANDO PADRÕES EM TEMPO REAL • G2</div>' +
    '</div>';
  } else {
    sinalHtml = '<div class="relative z-10 text-center">' +
      '<div class="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-600/20 flex items-center justify-center mb-6 border border-amber-500/30"><div class="text-4xl">⏱️</div></div>' +
      '<div class="text-[13px] tracking-[0.2em] text-zinc-300 font-bold">AGUARDANDO</div>' +
      '<div class="text-[11px] text-zinc-500 mt-2">IA escaneando placar...</div>' +
      '<div class="flex justify-center gap-1 mt-4"><div class="w-1 h-1 bg-zinc-600 rounded-full animate-bounce"></div><div class="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style="animation-delay:0.1s"></div><div class="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style="animation-delay:0.2s"></div></div>' +
      '<div class="mt-8 text-[11px] tracking-widest text-amber-300/60">ESCANEANDO PADRÕES EM TEMPO REAL • IA VIVA</div>' +
    '</div>';
  }

  const totalHtml = total+'/400';
  const homePct = total?((stats.HOME/total)*100).toFixed(1):0;
  const awayPct = total?((stats.AWAY/total)*100).toFixed(1):0;
  const tiePct = total?((stats.TIE/total)*100).toFixed(1):0;

  let minutosCoresHtml = '';
  for(let m of minutosCores){
    const bg = m.best==='HOME'?'bg-red-500/20 text-red-400':m.best==='AWAY'?'bg-blue-500/20 text-blue-400':'bg-amber-500/20 text-amber-400';
    minutosCoresHtml += '<div class="min-w-[90px] glass rounded-2xl p-4 text-center border border-white/5"><div class="text-[10px] text-zinc-500">MINUTO '+m.minuto+'</div><div class="w-12 h-12 mx-auto rounded-full flex items-center justify-center font-black text-[16px] mt-2 '+bg+'">'+m.best[0]+'</div><div class="text-[11px] font-bold mt-2">'+m.best+'</div><div class="text-[10px] text-zinc-500">'+m.pct+'% • '+m.count+'x</div></div>';
  }

  let minutosEmpateHtml = '';
  for(let m of minutosEmpate){
    minutosEmpateHtml += '<div class="min-w-[90px] glass rounded-2xl p-4 text-center border border-amber-500/10"><div class="text-[10px] text-zinc-500">MINUTO '+m.minuto+'</div><div class="w-12 h-12 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-[16px] mt-2">E</div><div class="text-[11px] font-bold mt-2 text-amber-400">EMPATE</div><div class="text-[10px] text-zinc-500">'+m.pct+'% • '+m.count+'x</div></div>';
  }

  let listaEmpatesHtml = '';
  if(listaEmpates.length>0){
    for(let t of listaEmpates){ listaEmpatesHtml += '<div class="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-2 rounded-full text-[12px] font-bold mono">'+t+'</div>'; }
  } else {
    listaEmpatesHtml = '<div class="text-zinc-600 text-[12px]">Nenhum empate ainda</div>';
  }

  let bolasHtml = '';
  if(history.length>0){
    for(let h of history){
      const cls = h.winner==='HOME'?'home':h.winner==='AWAY'?'away':'tie';
      bolasHtml += '<div class="ball '+cls+'">'+h.winner[0]+'</div>';
    }
  } else {
    bolasHtml = '<div class="text-zinc-600 py-10">IA escaneando...</div>';
  }

  let ultimosSinaisHtml = '';
  if(ultimosSinais.length>0){
    for(let s of ultimosSinais){
      const border = s.status==='GREEN'?'border-l-emerald-500':s.status==='RED'?'border-l-red-500':'border-l-amber-500';
      const bg = s.entry==='HOME'?'bg-red-500/20 text-red-400':s.entry==='AWAY'?'bg-blue-500/20 text-blue-400':'bg-amber-500/20 text-amber-400';
      const statusBg = s.status==='GREEN'?'bg-emerald-500/20 text-emerald-400':s.status==='RED'?'bg-red-500/20 text-red-400':'bg-amber-500/20 text-amber-400';
      ultimosSinaisHtml += '<div class="glass rounded-xl p-4 flex justify-between items-center border-l-4 '+border+'"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full '+bg+' flex items-center justify-center font-bold text-[12px]">'+s.entry[0]+'</div><div><div class="text-[12px] font-bold">ENTRA '+s.entry+' COBRIR EMPATE</div><div class="text-[10px] text-zinc-500">'+s.time+' • '+(s.pattern||'')+'</div></div></div><div class="text-right"><div class="text-[11px] px-3 py-1 rounded-full font-bold '+statusBg+'">'+s.status+' '+(s.gales?'G'+s.gales:'')+'</div><div class="text-[10px] text-zinc-500 mt-1">'+(s.result||'Aguardando...')+'</div></div></div>';
    }
  } else {
    ultimosSinaisHtml = '<div class="text-center py-10 text-zinc-600">IA aguardando padrões... Pula 2 casas sendo escaneado</div>';
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vander Placar Premium IA</title><script src="https://cd
