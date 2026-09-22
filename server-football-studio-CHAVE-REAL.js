import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = 'https://ulzvxigcdcwbyfnpewjc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsenZ4aWdjZGN3YnlmbnBld2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk1NzcsImV4cCI6MjEwMzY5NTU3N30.dxjQdE0uLsy1sKt8kL6xfBhqXyBb-dKW-UB_ikDOXx8';
const SUPABASE_AUTH_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImRkZmZhM2QzLTEyYmItNGZjZi1hZGIxLTJjNGNiMTgxNzNlZCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3VsenZ4aWdjZGN3YnlmbnBld2pjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDExNDMxYi01NzRmLTQwMmEtODIyYi0yZjQ1YzE2NzMwMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzkwMTAwMzg2LCJpYXQiOjE3OTAwOTY3ODYsImVtYWlsIjoic2FudGFyb3NhdmFuZGVyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJzYW50YXJvc2F2YW5kZXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IlZhbmRlciBOYXNjaW1lbnRvIFNhbnRhIFJvc2EiLCJwaG9uZSI6IiszNTE5Mjk0NDY0MjkiLCJwaG9uZV9jb3VudHJ5X2NvZGUiOiIrMzUxIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoid3BwIiwic3ViIjoiM2QxMTQzMWItNTc0Zi00MDJhLTgyMmItMmY0NWMxNjczMDJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODk5OTY2MTV9XSwic2Vzc2lvbl9pZCI6Ijc5MjVkMTA2LWI1NzQtNDAwNi1iNmM3LTg0NDFjYzU0MWY4OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.j3f0q5UlYTzETY2-PL7y8L-4_r2eBSC4Cr85ea0KU-hTq50tZ3p5HCgZ-QZElg1y-p5WC-y6RAc6z7X6MkXeaQ';

let lastRounds = [];
let lastUpdate = null;
let isCollecting = false;

async function fetchRealRounds() {
    try {
        isCollecting = true;
        // Usa anon key como apikey e auth token como Authorization (mais permissivo)
        const response = await fetch(`${SUPABASE_URL}/rest/v1/football_studio_rounds?order=created_at.desc&limit=50`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const err = await response.text();
            console.log(`[ERRO SUPABASE] ${response.status} - ${err}`);
            // fallback tenta só com anon
            const response2 = await fetch(`${SUPABASE_URL}/rest/v1/football_studio_rounds?order=created_at.desc&limit=50`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response2.ok) {
                console.log(`[ERRO FALLBACK] ${response2.status} - ${await response2.text()}`);
                return;
            }
            const data2 = await response2.json();
            lastRounds = data2;
            lastUpdate = new Date().toISOString();
            console.log(`[COLETADO REAL] ${data2.length} rodadas - ${lastUpdate}`);
            return;
        }
        
        const data = await response.json();
        lastRounds = data;
        lastUpdate = new Date().toISOString();
        console.log(`[COLETADO REAL] ${data.length} rodadas - ${lastUpdate} - Última: ${data[0]?.round_number || 'N/A'}`);
    } catch (e) {
        console.log(`[ERRO FETCH] ${e.message}`);
    } finally {
        isCollecting = false;
    }
}

// Coleta a cada 10 segundos
setInterval(fetchRealRounds, 10000);
fetchRealRounds(); // primeira coleta imediata

app.get('/', (req, res) => {
    res.json({
        status: 'Football Studio Vander - ONLINE',
        collecting: isCollecting,
        lastUpdate,
        totalRounds: lastRounds.length,
        lastRound: lastRounds[0] || null,
        endpoints: {
            rounds: '/api/rounds',
            latest: '/api/latest',
            stats: '/api/stats'
        }
    });
});

app.get('/api/rounds', (req, res) => {
    res.json({
        success: true,
        count: lastRounds.length,
        lastUpdate,
        data: lastRounds
    });
});

app.get('/api/latest', (req, res) => {
    res.json({
        success: true,
        lastUpdate,
        data: lastRounds[0] || null
    });
});

app.get('/api/stats', (req, res) => {
    const home = lastRounds.filter(r => r.winner === 'HOME').length;
    const away = lastRounds.filter(r => r.winner === 'AWAY').length;
    const tie = lastRounds.filter(r => r.winner === 'TIE').length;
    res.json({
        success: true,
        total: lastRounds.length,
        stats: { HOME: home, AWAY: away, TIE: tie },
        lastUpdate
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Football Studio Vander rodando na porta ${PORT}`);
    console.log(`📡 Coletando de: ${SUPABASE_URL}`);
});
