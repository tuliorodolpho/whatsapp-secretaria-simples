const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const pino = require('pino');
const fs = require('fs');

const app = express();
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
let sock;
let eventos = [];

// Conecta WhatsApp
async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if(connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando:', shouldReconnect);
            if(shouldReconnect) {
                conectarWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('✅ WhatsApp conectado!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const remetente = msg.key.remoteJid;

        console.log('Mensagem:', texto);

        let resposta = '';

        if (texto.toLowerCase() === 'menu') {
            resposta = `🤖 *SECRETÁRIA IA*

📝 Comandos:
• "Reunião amanhã 15h"
• "Anota: comprar leite"
• *agenda* - ver eventos`;
        }
        else if (texto.toLowerCase() === 'agenda') {
            if (eventos.length === 0) {
                resposta = '✨ Nenhum compromisso!';
            } else {
                resposta = '📅 *Seus compromissos:*\n\n';
                eventos.forEach(e => {
                    resposta += `• ${e.titulo}\n  ${e.data} às ${e.hora}\n\n`;
                });
            }
        }
        else {
            const info = await processarIA(texto);

            if (info.tipo === 'compromisso' && info.data && info.hora) {
                eventos.push(info);
                resposta = `✅ *Agendado!*\n\n📅 ${info.titulo}\n🕐 ${info.data} às ${info.hora}`;
            } else {
                resposta = `✅ *Anotado!*\n\n📝 ${info.titulo}`;
            }
        }

        await sock.sendMessage(remetente, { text: resposta });
    });
}

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
        return { tipo: 'anotacao', titulo: texto, data: null, hora: null };
    }
}

// Endpoint teste
app.get('/', (req, res) => {
    res.send(`✅ Secretária Online! Eventos: ${eventos.length}`);
});

app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 Servidor rodando!');
    conectarWhatsApp();
});
