
// FOOTBALL STUDIO 100% AUTOMÁTICO - COM CHAVE REAL EXTRAÍDA DO SEU PRINT
// Fonte: https://ulzvxigcdcwbyfnpewjc.supabase.co/rest/v1/football_studio_rounds
// Chave anon pública - pode ficar no código, é pública por design

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnluZm5wZXdqYyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg4MTE5NTc3LCJleHAiOjIxMDM2OTU1NzczfQ.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';

let sqlite = null;
let useSQLite = false;
try {
  const better = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'football_studio.db');
  sqlite = better(dbPath);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      externalId TEXT UNIQUE NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      collected_at TEXT NOT NULL,
      rawData TEXT,
      hour INTEGER,
      dayOfWeek INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_created_at ON rounds(created_at);
  `);
  useSQLite = true;
  console.log('[DB] SQLite OK');
} catch(e) {
  console.log('[DB] JSON fallback:', e.message);
}

const JSON_DB_PATH = path.join(__dirname, 'football_studio_db.json');
let jsonDB = { rounds: [] };
if (!useSQLite && fs.existsSync(JSON_DB_PATH)) {
  try { jsonDB = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8')); } catch(e) {}
}

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

let collectorStatus = {
  status: 'iniciando',
  source: `${SUPABASE_URL}/rest/v1/football_studio_rounds`,
  lastFetch: null,
  lastRoundAt: null,
  lastRound: null,
  totalStored: 0,
  totalFetched: 0,
  totalNew: 0,
  lastError: null,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  uptime: 0,
  startTime: new Date().toISOString(),
  mode: 'Coleta automática a cada 10s - Supabase REAL'
};

function getAllRounds(limit = null, since = null) {
  if (useSQLite) {
    let query = 'SELECT * FROM rounds ORDER BY datetime(created_at) ASC';
    let params = [];
    if (since) {
      query = 'SELECT * FROM rounds WHERE datetime(created_at) >= datetime(?) ORDER BY datetime(created_at) ASC';
      params = [since];
    }
    const rows = sqlite.prepare(query).all(...params);
    if (limit) return rows.slice(-limit);
    return rows;
  } else {
    let arr = jsonDB.rounds.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    if (since) arr = arr.filter(r => new Date(r.created_at) >= new Date(since));
    if (limit) return arr.slice(-limit);
    return arr;
  }
}

function buildExternalId(item) {
  return `${item.created_at}_${item.result}_${item.home_score ?? ''}_${item.away_score ?? ''}`;
}

function saveRound(item) {
  const externalId = buildExternalId(item);
  const now = new Date();
  const createdAtDate = new Date(item.created_at);
  const round = {
    externalId,
    result: item.result,
    created_at: item.created_at,
    home_score: item.home_score ?? null,
    away_score: item.away_score ?? null,
    collected_at: now.toISOString(),
    rawData: JSON.stringify(item).substring(0,2000),
    hour: createdAtDate.getHours(),
    dayOfWeek: createdAtDate.getDay()
  };
  if (useSQLite) {
    try {
      const stmt = sqlite.prepare(`INSERT OR IGNORE INTO rounds (externalId, result, created_at, home_score, away_score, collected_at, rawData, hour, dayOfWeek) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const res = stmt.run(round.externalId, round.result, round.created_at, round.home_score, round.away_score, round.collected_at, round.rawData, round.hour, round.dayOfWeek);
      if (res.changes > 0) {
        collectorStatus.totalStored++;
        collectorStatus.totalNew++;
        collectorStatus.lastRound = round;
        collectorStatus.lastRoundAt = round.created_at;
        console.log(`[NOVO] ${round.result} | ${round.created_at} | ${round.home_score}x${round.away_score}`);
        return { saved: true, isNew: true };
      } else return { saved: false, isNew: false };
    } catch(e) { collectorStatus.lastError = e.message; return { saved: false }; }
  } else {
    if (jsonDB.rounds.find(r => r.externalId === externalId)) return { saved: false, isNew: false };
    jsonDB.rounds.push(round);
    jsonDB.rounds = jsonDB.rounds.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).slice(-20000);
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(jsonDB, null, 2));
    collectorStatus.totalStored = jsonDB.rounds.length;
    collectorStatus.totalNew++;
    collectorStatus.lastRound = round;
    collectorStatus.lastRoundAt = round.created_at;
    console.log(`[NOVO JSON] ${round.result} | ${round.created_at}`);
    return { saved: true, isNew: true };
  }
}

async function fetchFromSupabase() {
  let fetchFn;
  try { fetchFn = (await import('node-fetch')).default; } catch(e) { fetchFn = global.fetch; }
  const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/football_studio_rounds?select=*&created_at=gte.${yesterday}&order=created_at.desc&limit=5000`;
  const headers = { 'Accept': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
  console.log(`[FETCH] ${url.slice(0,80)}...`);
  try {
    const response = await fetchFn(url, { headers, timeout: 15000 });
    collectorStatus.lastFetch = new Date().toISOString();
    collectorStatus.totalFetched++;
    if (!response.ok) {
      const text = await response.text().catch(()=> '');
      const errorMsg = `HTTP ${response.status} - ${text.slice(0,500)}`;
      console.log(`[FETCH ERRO] ${errorMsg}`);
      collectorStatus.lastError = errorMsg;
      return { success: false, error: errorMsg, status: response.status };
    }
    const data = await response.json();
    console.log(`[FETCH OK] ${data.length} rodadas | Mais recente: ${data[0]?.created_at} - ${data[0]?.result}`);
    if (!Array.isArray(data)) return { success: false, error: 'Formato inesperado' };
    let newCount = 0;
    const sortedAsc = [...data].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    for (const item of sortedAsc) {
      const res = saveRound(item);
      if (res.isNew) newCount++;
    }
    console.log(`[COLETA] ${newCount} novas de ${data.length} | Total: ${collectorStatus.totalStored}`);
    return { success: true, total: data.length, new: newCount, latest: data[0] || null };
  } catch(e) {
    console.log(`[FETCH EXCEÇÃO] ${e.message}`);
    collectorStatus.lastError = e.message;
    return { success: false, error: e.message };
  }
}

let collectInterval = null;
async function startCollector() {
  console.log('\n========================================');
  console.log('FOOTBALL STUDIO - COLETOR REAL COM CHAVE');
  console.log(`Fonte: ${SUPABASE_URL}/rest/v1/football_studio_rounds`);
  console.log(`Chave: ${SUPABASE_ANON_KEY.slice(0,20)}... OK`);
  console.log('========================================\n');
  const existing = getAllRounds();
  collectorStatus.totalStored = existing.length;
  if (existing.length > 0) {
    collectorStatus.lastRound = existing[existing.length-1];
    collectorStatus.lastRoundAt = existing[existing.length-1].created_at;
    console.log(`[INIT] Banco já tem ${existing.length} | Última: ${collectorStatus.lastRoundAt}`);
  }
  await fetchFromSupabase();
  collectInterval = setInterval(async () => { await fetchFromSupabase(); }, 10000);
  setInterval(() => { collectorStatus.uptime = process.uptime(); }, 5000);
}

app.get('/', (req,res) => res.json({ name: 'FOOTBALL STUDIO 100% AUTOMÁTICO REAL', source: `${SUPABASE_URL}/rest/v1/football_studio_rounds`, hasAnonKey: true, status: collectorStatus, endpoints: ['GET /api/rounds','GET /api/rounds/latest','GET /api/stats','GET /api/health','GET /api/test-fetch'] }));
app.get('/api/health', (req,res) => {
  const rounds = getAllRounds();
  const last = rounds.length ? rounds[rounds.length-1] : null;
  const now = Date.now();
  const lastAt = collectorStatus.lastRoundAt ? new Date(collectorStatus.lastRoundAt).getTime() : null;
  const ageMinutes = lastAt ? Math.floor((now - lastAt)/60000) : null;
  res.json({ servidor: 'online', status: collectorStatus.lastError ? 'erro' : 'ok', fonte: collectorStatus.source, ultima_consulta: collectorStatus.lastFetch, ultima_rodada_recebida: collectorStatus.lastRoundAt, ultima_rodada: collectorStatus.lastRound || last, quantidade_total_armazenada: rounds.length, total_consultas: collectorStatus.totalFetched, total_novas: collectorStatus.totalNew, uptime: collectorStatus.uptime, startTime: collectorStatus.startTime, tem_chave_anon: true, ultimo_erro: collectorStatus.lastError, idade_ultima_rodada_min: ageMinutes, isStale: ageMinutes != null && ageMinutes > 15, modo: collectorStatus.mode, banco: useSQLite ? 'SQLite' : 'JSON', mensagem: last ? `Última: ${last.result} ${last.home_score}x${last.away_score} há ${ageMinutes} min` : 'Aguardando primeira rodada real...' });
});
app.get('/api/rounds', (req,res) => { const limit = parseInt(req.query.limit) || 500; const since = req.query.since || null; res.json(getAllRounds(limit, since)); });
app.get('/api/rounds/latest', (req,res) => { res.json(getAllRounds(1)[0] || null); });
app.get('/api/stats', (req,res) => {
  const rounds = getAllRounds();
  const total = rounds.length;
  if (total === 0) return res.json({ total: 0, mensagem: 'Aguardando coleta real' });
  const home = rounds.filter(r => r.result === 'Home').length;
  const away = rounds.filter(r => r.result === 'Away').length;
  const tie = rounds.filter(r => r.result === 'Tie' || r.result === 'Draw').length;
  const banker = rounds.filter(r => r.result === 'Banker').length;
  const player = rounds.filter(r => r.result === 'Player').length;
  const avgHome = rounds.reduce((s,r)=> s + (r.home_score||0), 0) / total;
  const avgAway = rounds.reduce((s,r)=> s + (r.away_score||0), 0) / total;
  res.json({ total, distribuicao: { Home: { count: home, pct: total ? (home/total*100).toFixed(2) : 0 }, Away: { count: away, pct: total ? (away/total*100).toFixed(2) : 0 }, Tie: { count: tie, pct: total ? (tie/total*100).toFixed(2) : 0 }, Banker: { count: banker, pct: total ? (banker/total*100).toFixed(2) : 0 }, Player: { count: player, pct: total ? (player/total*100).toFixed(2) : 0 } }, scores: { avg_home: avgHome.toFixed(2), avg_away: avgAway.toFixed(2) }, periodo: total ? `${rounds[0].created_at} até ${rounds[rounds.length-1].created_at}` : null, primeira_rodada: rounds[0] || null, ultima_rodada: rounds[rounds.length-1] || null, fonte: 'Dados reais coletados do Supabase' });
});
app.get('/api/test-fetch', async (req,res) => { const result = await fetchFromSupabase(); res.json({ teste: 'Coleta real', resultado: result, total: getAllRounds().length, ultimas: getAllRounds(5).slice(-5), status: collectorStatus }); });
app.post('/api/test-fetch', async (req,res) => { const result = await fetchFromSupabase(); res.json({ teste: 'Coleta real', resultado: result, total: getAllRounds().length, status: collectorStatus }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => { console.log(`\nFootball Studio API rodando na porta ${PORT}`); await startCollector(); });
