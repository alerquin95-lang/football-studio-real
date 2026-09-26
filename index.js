import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors());

// Simula coleta do jokeria.app - depois colocamos o coletor real
let history = [];
let stats = { HOME: 0, AWAY: 0, TIE: 0 };
setInterval(() => {
  const r = Math.random();
  const winner = r < 0.44 ? 'HOME' : r < 0.88 ? 'AWAY' : 'TIE';
  history.unshift({ round: history.length + 1, winner, time: new Date().toLocaleTimeString('pt-BR'), source: 'simulacao' });
  if (history.length > 100) history.pop();
  stats[winner]++;
  console.log(`[COLETADO] #${history.length} - ${winner}`);
}, 10000);

app.get('/', (req, res) => {
  const total = history.length;
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jokeria Cloud ONLINE</title>
<style>body{background:#0a0e1a;color:#fff;font-family:Arial;padding:20px}.card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;margin:10px 0}.badge{padding:4px 10px;border-radius:20px;font-size:12px}.HOME{background:#ef44441a;color:#ef4444}.AWAY{background:#3b82f61a;color:#3b82f6}.TIE{background:#eab3081a;color:#eab308}</style>
</head><body>
<h1>🎰 Jokeria Cloud - ONLINE ✅</h1>
<p>Se voce esta vendo isso, o Render ficou LIVE!</p>
<div class="card">Total coletado: ${total} | HOME: ${stats.HOME} | AWAY: ${stats.AWAY} | TIE: ${stats.TIE}</div>
<div class="card"><h3>Ultimas 20</h3>${history.slice(0,20).map(h=>`<div>#${h.round} - <span class="badge ${h.winner}">${h.winner}</span> - ${h.time}</div>`).join('')}</div>
<script>setTimeout(()=>location.reload(), 10000)</script>
</body></html>`);
});

app.get('/api/rounds', (req, res) => res.json({ success: true, count: history.length, data: history }));
app.get('/api/stats', (req, res) => res.json({ success: true, stats, total: history.length }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 ONLINE na porta ${PORT} - Indo coletar do jokeria.app`));
