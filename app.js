const express = require('express');
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const MessagingResponse = twilio.twiml.MessagingResponse;
let anotacoes = [];

app.post('/webhook', (req, res) => {
    const twiml = new MessagingResponse();

    const mensagem = req.body.Body || '';
    const texto = mensagem.toLowerCase().trim();

    console.log('Recebido:', mensagem);

    let resposta = '';

    if (texto === 'menu') {
        resposta = '🤖 SECRETÁRIA\n\nmenu - este menu\nagenda - ver anotações\nlimpar - apagar tudo';
    }
    else if (texto === 'agenda') {
        if (anotacoes.length === 0) {
            resposta = '✨ Nada anotado!';
        } else {
            resposta = '📝 Anotações:\n\n';
            anotacoes.forEach((a, i) => {
                resposta += `${i + 1}. ${a}\n`;
            });
        }
    }
    else if (texto === 'limpar') {
        anotacoes = [];
        resposta = '🗑️ Apagado!';
    }
    else {
        anotacoes.push(mensagem);
        resposta = `✅ Anotado: "${mensagem}"\n\nTotal: ${anotacoes.length}`;
    }

    twiml.message(resposta);
    res.type('text/xml');
    res.send(twiml.toString());
});

app.get('/', (req, res) => {
    res.send(`✅ Online! Anotações: ${anotacoes.length}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Rodando!');
});
