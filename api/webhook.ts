import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StateMachine } from '../src/services/StateMachine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = req.body;
        
        const phone = body.phone || body.sender || '';
        const message = body.text || body.message || '';

        const isGroup = body.isGroup || phone.includes('@g.us') || phone.includes('-');
        if (!phone || !message || isGroup) {
            return res.status(200).send('Ignored');
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        console.log(`[Webhook Vercel] Mensagem recebida de ${cleanPhone}: ${message}`);

        // Fire and forget: dispara a máquina de estados sem await para liberar o webhook
        StateMachine.processMessage(cleanPhone, message).catch(err => {
            console.error('Erro na StateMachine:', err);
        });

        // Retorna imediatamente para a Mega API
        return res.status(200).send('OK');
    } catch (error) {
        console.error('Erro no webhook:', error);
        return res.status(500).send('Internal Server Error');
    }
}
