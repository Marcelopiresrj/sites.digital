import express, { Request, Response } from 'express';
import { StateMachine } from './services/StateMachine';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Webhook para a Mega API
app.post('/api/webhook', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        
        const phone = body.phone || body.sender || '';
        const message = body.text || body.message || '';

        const isGroup = body.isGroup || phone.includes('@g.us') || phone.includes('-');
        if (!phone || !message || isGroup) {
            res.status(200).send('Ignored');
            return;
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');

        console.log(`[Webhook] Mensagem recebida de ${cleanPhone}: ${message}`);

        // A Mega API não precisa esperar a State Machine terminar para receber o 200 OK
        // Mas se quisermos garantir, podemos dar o await.
        // O ideal é usar Fire and Forget internamente para liberar a API rapidamente.
        StateMachine.processMessage(cleanPhone, message).catch(err => {
            console.error('Erro na StateMachine:', err);
        });

        // Resposta imediata para a Mega API
        res.status(200).send('OK');
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`AgendaZap Server running on port ${PORT}`);
});


