import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StateMachine } from '../src/services/StateMachine';
import { supabase } from '../src/lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = req.body;
        
        // LOG TEMPORÁRIO PARA DEBUG DA MEGA API
        await supabase.from('logs_chat').insert([{
            telefone: 'DEBUG_RAW_PAYLOAD',
            mensagem: JSON.stringify(body).substring(0, 500),
            direcao: 'inbound'
        }]);

        const phone = body.phone || body.sender || '';
        const message = body.text || body.message || '';

        const isGroup = body.isGroup || phone.includes('@g.us') || phone.includes('-');
        if (!phone || !message || isGroup) {
            return res.status(200).send('Ignored');
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        console.log(`[Webhook Vercel] Mensagem recebida de ${cleanPhone}: ${message}`);

        // Em Serverless (Vercel), DEVE-SE usar await, senão o ambiente
        // congela a execução da função antes de terminar as chamadas ao Supabase.
        await StateMachine.processMessage(cleanPhone, message);

        // Retorna imediatamente para a Mega API
        return res.status(200).send('OK');
    } catch (error) {
        console.error('Erro no webhook:', error);
        return res.status(500).send('Internal Server Error');
    }
}
