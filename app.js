const express = require('express');
const axios = require('axios');
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const client = twilio(TWILIO_SID, TWILIO_TOKEN);
let eventos = [];

async function processarIA(texto) {
    try {
        const hoje = new Date();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);

        const prompt = `Analise e responda JSON:
Hoje: ${hoje.toISOString().split('T')[0]}
Amanhã: ${amanha.toISOString().split('T')[0]}

Se tiver HORA = compromisso
Se "anota" = anotacao

JSON: {"tipo": "compromisso|anotacao", "titulo": "texto", "data": "YYYY-MM-DD", "hora": "HH:MM"}

Texto: ${texto}`;

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            },
            {
                headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
            }
        );

        return JSON.parse(response.data.choices[0].message.content);
    } catch (e) {
        console.error('Erro IA:', e);
        return { tipo: 'anotacao', titulo: texto, data: null, hora: null };
    }
}

app.post('/webhook', async (req, res) => {
    const mensagem = req.body.Body || '';
    const remetente = req.body.From;

    console.log('Mensagem recebida:', mensagem);

    const twiml = new twilio.twiml.MessagingResponse();
    let resposta = '';

    const texto = mensagem.toLowerCase().trim();

    if (texto === 'menu' || texto === 'ajuda') {
        resposta = `🤖 *SECRETÁRIA IA*

📝 Comandos:
• "Reunião amanhã 15h"
• "Anota: comprar leite"
• *agenda* - ver eventos

Seja natural!`;
    }
    else if (texto === 'agenda') {
        if (eventos.length === 0) {
            resposta = '✨ Nenhum compromisso agendado!';
        } else {
            resposta = '📅 *Seus compromissos:*\n\n';
            eventos.forEach(e => {
                resposta += `• ${e.titulo}\n  ${e.data} às ${e.hora}\n\n`;
            });
        }
    }
    else {
        const info = await processarIA(mensagem);

        if (info.tipo === 'compromisso' && info.data && info.hora) {
            eventos.push(info);
            resposta = `✅ *Compromisso Agendado!*\n\n📅 ${info.titulo}\n🕐 ${info.data} às ${info.hora}`;
        } else {
            resposta = `✅ *Anotado!*\n\n📝 ${info.titulo}`;
        }
    }

    twiml.message(resposta);

    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
});

app.get('/', (req, res) => {
    res.send(`✅ Secretária IA Online!\n📊 Eventos: ${eventos.length}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
