import express from 'express';
const app = express();
app.get('/', (req,res)=>res.send('<h1>Jokeria Cloud ONLINE! Coletando...</h1><p>Se voce esta vendo isso, deu certo! Agora vou colocar o coletor completo.</p>'));
app.get('/api/rounds', (req,res)=>res.json({success:true, count:0, data:[STRIPPED]
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log('Rodando na porta '+PORT));
