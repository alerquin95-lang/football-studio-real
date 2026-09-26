import http from 'http';
import fs from 'fs';
const A0='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[STRIPPED 127';
const A1=' bytes].dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx';
const A2='8';
const ANON=A0+A1+A2;
const B0='[STRIPPED 96 bytes].[STRIPPED 916 bytes].[STRIPPED';
const B1=' 86 bytes]';
let TOKEN=B0+B1;

const SUPABASE_URL='https://ulzvxigcdcwbyfnpewjc.supabase.co';
const USER='santarosavander@gmail.com';
const PASS='131619jV*';
let history=[],stats={HOME:0,AWAY:0,TIE:0};
let botStatus='Conectando...',lastError='';
let signals=[],greens=0,reds=0,assert=0;
let aiState='INICIANDO',currentSignal=null;
function load(){try{if(fs.existsSync('./token.json')){const j=JSON.parse(fs.readFileSync('./token.json','utf8'));if(j.token)TOKEN=j.token;}if(fs.existsSync('./history.json')){const d=JSON.parse(fs.readFileSync('./history.json','utf8'));history=d.slice(0,400);stats={HOME:0,AWAY:0,TIE:0};for(let i=0;i<d.length;i++){const w=d[i].winner;if(stats[w]!==undefined)stats[w]++;}}if(fs.existsSync('./signals.json')){const s=JSON.parse(fs.readFileSync('./signals.json','utf8'));signals=s.slice(0,100);let g=0,r=0;for(let i=0;i<s.length;i++){if(s[i].status==='GREEN')g++;if(s[i].status==='RED')r++;}greens=g;reds=r;const t=g+r;if(t>0)assert=Math.round((g/t)*100);}}catch(e){}}
function saveH(){try{fs.writeFileSync('./history.json',JSON.stringify(history.slice(0,400)));}catch(e){}}
function saveS(){try{fs.writeFileSync('./signals.json',JSON.stringify(signals.slice(0,100)));}catch(e){}}
function norm(raw){const s=(raw||'').toString().trim().toUpperCase();if(['HOME','H','CASA','1','RED','R'].includes(s))return 'HOME';if(['AWAY','A','FORA','2','BLUE','B'].includes(s))return 'AWAY';if(['TIE','T','EMPATE','0','X','E','YELLOW'].includes(s))return 'TIE';if(s.includes('HOME'))return 'HOME';if(s.includes('AWAY'))return 'AWAY';if(s.includes('TIE'))return 'TIE';return null;}
function infer(row){let raw=row.winner||row.result||row.outcome||'';raw=raw||row.winning_side||row.side||'';let n=norm(raw);if(n)return n;if(row.home_score!=null&&row.away_score!=null){const hs=Number(row.home_score);const as=Number(row.away_score);if(hs>as)return 'HOME';if(as>hs)return 'AWAY';return 'TIE';}if(row.home_card_value!=null){const hv=Number(row.home_card_value);const av=Number(row.away_card_value);if(hv>av)return 'HOME';if(av>hv)return 'AWAY';return 'TIE';}return null;}
function calcPatterns(){if(history.length<50)return [];const pats=[],cols=['HOME','AWAY'];for(let c=0;c<cols.length;c++){const color=cols[c];let total=0,voltou=0;for(let i=3;i<history.length-5;i++){const cur=history[i];if(cur&&cur.winner==='TIE'){const bef=history[i+1];const corAntes=bef?bef.winner:null;if(corAntes&&corAntes!=='TIE'&&corAntes===color){total++;const aft=history[i-3];const corDepois=aft?aft.winner:null;if(corDepois===color)voltou++;}}}const taxa=total?(voltou/total*100):0;if(total>=3)pats.push({cor:color,taxa:taxa,ac:voltou,tt:total});}pats.sort(function(a,b){return b.taxa-a.taxa;});return pats;}
function analyze(){if(history.length<20){aiState='AGUARDANDO '+history.length;return;}aiState='IA ESCANEANDO '+history.length;const pats=calcPatterns();if(currentSignal){for(let i=0;i<signals.length;i++){const s=signals[i];if(s.id===currentSignal.id&&s.status==='WAITING'){aiState='SINAL ATIVO G'+(currentSignal.gales||0);return;}}}const best=pats[0];if(!best||best.taxa<60){let txt='ANALISANDO';if(best)txt+=' Melhor: '+best.cor+' '+best.taxa.toFixed(0)+'%';else txt+=' nenhum';aiState=txt;return;}const ultimo=history[0]?history[0].winner:null;if(ultimo==='TIE'){const corAntes=history[1]?history[1].winner:null;if(corAntes&&corAntes!=='TIE'){let pat=null;for(let i=0;i<pats.length;i++){if(pats[i].cor===corAntes){pat=pats[i];break;}}if(pat&&pat.taxa>=60){currentSignal={id:Date.now(),entry:corAntes,color:corAntes==='HOME'?'VERMELHO':'AZUL',time:new Date().toLocaleTimeString('pt-BR'),taxa:pat.taxa,ac:pat.ac,tt:pat.tt,gales:0,maxG:2};const copy={};for(let k in currentSignal)copy[k]=currentSignal[k];copy.status='WAITING';copy.pattern=corAntes+' antes TIE volta pular 2 - '+pat.taxa.toFixed(0)+'% ('+pat.ac+'/'+pat.tt+')';signals.unshift(copy);saveS();aiState='SINAL '+corAntes+' '+pat.taxa.toFixed(0)+'%';return;}}}aiState='AGUARDANDO Melhor: '+best.cor+' '+best.taxa.toFixed(0)+'%';}
function checkSig(newWinner){if(signals.length===0)return;for(let i=0;i<signals.length;i++){const s=signals[i];if(s.status==='WAITING'){if(newWinner===s.entry||newWinner==='TIE'){s.status='GREEN';s.result=newWinner;greens++;if(currentSignal&&currentSignal.id===s.id)currentSignal=null;saveS();break;}else{if(s.gales<s.maxG){s.gales++;}else{s.status='RED';s.result=newWinner;reds++;if(currentSignal&&currentSignal.id===s.id)currentSignal=null;saveS();break;}}}}const t=greens+reds;if(t>0)assert=Math.round((greens/t)*100);}
function add(w,row){if(history[0]?.round_id&&row?.id){if(history[0].round_id===row.id)return false;}const e={round_id:row.id,winner:w,time:new Date().toLocaleTimeString('pt-BR')};history.unshift(e);if(history.length>400)history.pop();stats[w]=(stats[w]||0)+1;saveH();checkSig(w);analyze();return true;}
async function refresh(){try{const url=SUPABASE_URL+'/auth/v1/token?grant_type=password';const body=JSON.stringify({email:USER,password:PASS});const res=await fetch(url,{method:'POST',headers:{'apikey':ANON,'Content-Type':'application/json'},body:body});const data=await res.json();if(data.access_token){TOKEN=data.access_token;const toSave=JSON.stringify({token:data.access_token});fs.writeFileSync('./token.json',toSave);return true;}return false;}catch(e){return false;}}
async function fetchReal(){try{let headers={'apikey':ANON,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};let url=SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=400';let res=await fetch(url,{headers});if(!res.ok&&res.status===401){await refresh();headers={'apikey':ANON,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};res=await fetch(url,{headers});}if(!res.ok){lastError=await res.text();botStatus='Erro: '+res.status;return;}const data=await res.json();if(!Array.isArray(data))return;let newCount=0;for(let j=data.length-1;j>=0;j--){const row=data[j];const n=infer(row);if(!n)continue;let exists=false;for(let k=0;k<history.length;k++){if(history[k].round_id===row.id){exists=true;break;}}if(!exists){if(add(n,row))newCount++;}}let msg='LIVE - '+history.length+'/400 - '+stats.HOME+'H '+stats.AWAY+'A '+stats.TIE+'T';if(newCount)msg+=' +'+newCount;botStatus=msg;}catch(e){lastError=e.message;botStatus='Erro: '+e.message;}}

function getHtml(){
const total=history.length;
const homePct=total?((stats.HOME/total)*100).toFixed(1):0;
const awayPct=total?((stats.AWAY/total)*100).toFixed(1):0;
const tiePct=total?((stats.TIE/total)*100).toFixed(1):0;
let sinalHtml='';
if(currentSignal){
const col=currentSignal.entry==='HOME'?'#ef4444':'#3b82f6';
sinalHtml+='<div style="background:rgba(16,185,129,0.1);';
sinalHtml+='border:2px solid '+col+';border-radius:12px;';
sinalHtml+='padding:10px;text-align:center">';
sinalHtml+='<div style="font-size:10px;color:#6b7280">IA PULA 2</div>';
sinalHtml+='<div style="font-size:10px;color:#9ca3af;margin:4px 0">';
sinalHtml+=currentSignal.entry+' antes TIE volta - ';
sinalHtml+=currentSignal.taxa.toFixed(0)+'% ('+currentSignal.ac;
sinalHtml+='/'+currentSignal.tt+')</div>';
sinalHtml+='<div style="font-size:18px;font-weight:900;color:'+col+'">';
sinalHtml+='ENTRA '+currentSignal.color+'</div>';
sinalHtml+='<div style="font-size:10px;background:rgba(255,255,255,0.1);';
sinalHtml+='display:inline-block;padding:3px 8px;border-radius:8px;margin-top:4px">';
sinalHtml+='COBRIR EMPATE - '+currentSignal.time+' G'+currentSignal.gales+'</div>';
sinalHtml+='<div style="font-size:9px;color:#10b981;margin-top:3px">';
sinalHtml+='IA '+currentSignal.taxa.toFixed(0)+'% - G2 1-2-4</div></div>';
}else{
sinalHtml+='<div style="text-align:center;padding:12px">';
sinalHtml+='<div style="font-size:20px">AI</div>';
sinalHtml+='<div style="font-weight:800;margin-top:4px">AGUARDANDO</div>';
sinalHtml+='<div style="font-size:9px;color:#6b7280;margin-top:2px">';
sinalHtml+=aiState+'</div></div>';
}
let bolas='';
for(let i=0;i<history.length;i++){
const h=history[i];
let cls='tie';
if(h.winner==='HOME')cls='home';
if(h.winner==='AWAY')cls='away';
bolas+='<div class="ball '+cls+'">'+h.winner[0]+'</div>';
}
let linhas='';
for(let i=0;i<history.length;i++){
const h=history[i];
let col='#eab308';
if(h.winner==='HOME')col='#ef4444';
if(h.winner==='AWAY')col='#3b82f6';
linhas+='<tr><td>#'+(total-i)+'</td>';
linhas+='<td style="color:'+col+';font-weight:700">'+h.winner+'</td>';
linhas+='<td>'+h.time+'</td></tr>';
}
let sinaisL='';
const ult=signals.slice(0,8);
for(let i=0;i<ult.length;i++){
const s=ult[i];
let border='#eab308';
if(s.status==='GREEN')border='#10b981';
if(s.status==='RED')border='#ef4444';
sinaisL+='<div style="background:#111827;border-left:4px solid ';
sinaisL+=border+';border-radius:8px;padding:6px;';
sinaisL+='display:flex;justify-content:space-between;';
sinaisL+='align-items:center;margin-bottom:4px">';
sinaisL+='<div style="display:flex;align-items:center;gap:4px">';
sinaisL+='<div style="width:20px;height:20px;border-radius:50%;';
sinaisL+='background:'+border+'30;color:'+border+';';
sinaisL+='display:flex;align-items:center;justify-content:center;';
sinaisL+='font-weight:800;font-size:9px">'+s.entry[0]+'</div>';
sinaisL+='<div><div style="font-size:9px;font-weight:700">';
sinaisL+='ENTRA '+s.entry+' COBRIR</div>';
sinaisL+='<div style="font-size:8px;color:#6b7280">'+s.time+'</div>';
sinaisL+='</div></div><div style="text-align:right">';
sinaisL+='<div style="font-size:8px;background:'+border+'20;';
sinaisL+='color:'+border+';padding:2px 4px;border-radius:6px;';
sinaisL+='font-weight:700">'+s.status+' '+(s.gales?'G'+s.gales:'')+'</div>';
sinaisL+='</div></div>';
}
if(!sinaisL){
sinaisL='<div style="text-align:center;padding:8px;';
sinaisL+='color:#6b7280;font-size:9px">IA aguardando... '+aiState+'</div>';
}
let html='';
html+='<!DOCTYPE html><html><head><meta charset="utf-8">';
html+='<meta name="viewport" content="width=device-width,initial-scale=1">';
html+='<title>Vander 400 IA G2</title>';
html+='<script src="https://cdn.tailwindcss.com"></script>';
html+='<style>body{background:#060a14;color:#e2e8f0;';
html+='font-family:system-ui;padding:8px}';
html+='.glass{background:rgba(17,24,39,0.9);';
html+='border:1px solid rgba(255,255,255,0.06);';
html+='border-radius:10px;padding:10px}';
html+='.ball{width:28px;height:28px;border-radius:50%;';
html+='display:flex;align-items:center;justify-content:center;';
html+='font-weight:800;font-size:10px;border:2px solid}';
html+='.ball.home{color:#ef4444;border-color:#ef4444;';
html+='background:rgba(239,68,68,0.15)}';
html+='.ball.away{color:#3b82f6;border-color:#3b82f6;';
html+='background:rgba(59,130,246,0.15)}';
html+='.ball.tie{color:#eab308;border-color:#eab308;';
html+='background:rgba(234,179,8,0.15)}</style></head><body>';
html+='<div style="max-width:1000px;margin:0 auto">';
html+='<div class="glass" style="display:flex;';
html+='justify-content:space-between;margin-bottom:8px">';
html+='<div><h1 style="font-size:16px;font-weight:900">';
html+='VANDER <span style="color:#10b981">400</span> - IA G2 PULA 2</h1>';
html+='<p style="font-size:9px;color:#6b7280">'+botStatus+' - '+aiState+'</p></div>';
html+='<div style="text-align:right">';
html+='<span style="color:#10b981;font-size:9px">LIVE IA G2</span>';
html+='<div style="font-size:8px;color:#6b7280;margin-top:2px">';
html+='<a href="/api/clear" style="color:#10b981">Limpar</a> | ';
html+='<a href="/api/raw" style="color:#10b981">RAW</a></div></div></div>';
html+='<div class="glass" style="margin-bottom:8px">';
html+='<h3 style="font-size:10px;font-weight:800;margin-bottom:6px">';
html+='SINAIS IA PULA 2 G2 1-2-4 - '+greens+'W '+reds+'R - '+assert+'%</h3>';
html+=sinalHtml+'</div>';
html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);';
html+='gap:6px;margin-bottom:8px">';
html+='<div class="glass" style="text-align:center">';
html+='<div style="font-size:8px;color:#6b7280">TOTAL</div>';
html+='<div style="font-size:16px;font-weight:800">'+total+'/400</div></div>';
html+='<div class="glass" style="text-align:center">';
html+='<div style="font-size:8px;color:#ef4444">HOME</div>';
html+='<div style="font-size:14px;font-weight:800;color:#ef4444">';
html+=stats.HOME+' '+homePct+'%</div></div>';
html+='<div class="glass" style="text-align:center">';
html+='<div style="font-size:8px;color:#3b82f6">AWAY</div>';
html+='<div style="font-size:14px;font-weight:800;color:#3b82f6">';
html+=stats.AWAY+' '+awayPct+'%</div></div>';
html+='<div class="glass" style="text-align:center">';
html+='<div style="font-size:8px;color:#eab308">TIE</div>';
html+='<div style="font-size:14px;font-weight:800;color:#eab308">';
html+=stats.TIE+' '+tiePct+'%</div></div></div>';
html+='<div class="glass" style="margin-bottom:8px">';
html+='<h3 style="font-size:9px;color:#6b7280;margin-bottom:6px">';
html+='PLACAR 400 - '+botStatus+'</h3>';
html+='<div style="display:flex;flex-wrap:wrap;gap:3px;';
html+='justify-content:center">'+(bolas||'Aguardando...')+'</div></div>';
html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
html+='<div class="glass"><h3 style="font-size:9px;color:#6b7280;';
html+='margin-bottom:6px">SINAIS G2</h3><div>'+sinaisL+'</div></div>';
html+='<div class="glass"><h3 style="font-size:9px;color:#6b7280;';
html+='margin-bottom:6px">HISTORICO 400</h3>';
html+='<table style="width:100%;font-size:10px"><thead>';
html+='<tr style="color:#6b7280;font-size:8px"><th>#</th><th>Res</th><th>Hora</th></tr>';
html+='</thead><tbody>'+(linhas||'<tr><td colspan=3 style="text-align:center;padding:12px;color:#6b7280">Conectando...</td></tr>')+'</tbody></table></div></div>';
html+='</div><script>setInterval(()=>location.reload(),15000);</script>';
html+='</body></html>';
return html;
}
const server=http.createServer(async (req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Content-Type, apikey, Authorization');
if(req.method==='OPTIONS'){res.writeHead(200);res.end();return;}
const url=new URL(req.url,'http://localhost');
if(url.pathname==='/api/rounds'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,count:history.length,botStatus,data:history}));return;}
if(url.pathname==='/api/stats'){res.writeHead(200,{'Content-Type':'application/json'});const out={success:true,stats,total:history.length,botStatus,error:lastError,greens,reds,assert,aiState,signal:currentSignal,signals:signals.slice(0,20)};res.end(JSON.stringify(out));return;}
if(url.pathname==='/api/clear'){try{fs.unlinkSync('./history.json');fs.unlinkSync('./signals.json');fs.unlinkSync('./token.json');}catch(e){}history=[];stats={HOME:0,AWAY:0,TIE:0};signals=[];currentSignal=null;greens=0;reds=0;assert=0;await fetchReal();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true}));return;}
if(url.pathname==='/api/raw'){try{let headers={'apikey':ANON,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};let r=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=20',{headers});if(!r.ok&&r.status===401){await refresh();headers={'apikey':ANON,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};r=await fetch(SUPABASE_URL+'/rest/v1/football_studio_rounds?select=*&order=created_at.desc&limit=20',{headers});}const data=await r.json();let distinct={};for(let row of data){const raw=row.winner||row.result||row.outcome||'NULL';distinct[raw]=(distinct[raw]||0)+1;}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({count:data.length,distinct,sample:data.slice(0,3)},null,2));}catch(e){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;}
if(url.pathname==='/'||url.pathname==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(getHtml());return;}
res.writeHead(404);res.end('Not found');
});
const PORT=process.env.PORT||10000;
server.listen(PORT,async()=>{console.log('VANDER 400 IA G2 PULA 2 na porta '+PORT);load();await fetchReal();setInterval(fetchReal,5000);setInterval(refresh,1000*60*30);});
  
