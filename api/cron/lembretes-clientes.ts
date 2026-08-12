import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../src/lib/supabase';
import { MegaApi } from '../../src/services/MegaApi';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Validar chave de segurança
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Buscar agendamentos confirmados que ainda não tiveram todos os lembretes enviados
        const { data: agendamentos, error } = await supabase
            .from('agendamentos')
            .select(`
                id, data_hora, lembrete_24h_enviado, lembrete_60m_enviado, lembrete_30m_enviado,
                clientes (nome, telefone),
                servicos (nome)
            `)
            .eq('status', 'confirmado')
            .or('lembrete_24h_enviado.eq.false,lembrete_60m_enviado.eq.false,lembrete_30m_enviado.eq.false');

        if (error) throw error;
        
        if (!agendamentos || agendamentos.length === 0) {
            return res.status(200).json({ message: 'Nenhum lembrete pendente.' });
        }

        const now = new Date();
        const results = [];

        for (const ag of agendamentos) {
            const agDate = new Date(ag.data_hora);
            const diffMs = agDate.getTime() - now.getTime();
            const diffMinutes = diffMs / (1000 * 60);

            if (diffMinutes < 0) continue; // Já passou

            let sent = false;
            let updateFields: any = {};
            const clienteTel = ag.clientes.telefone;
            const horaStr = agDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Regra 30 min (entre 15 e 30 minutos)
            if (diffMinutes <= 30 && diffMinutes > 0 && !ag.lembrete_30m_enviado) {
                await MegaApi.sendMessage(clienteTel, `⏳ Olá ${ag.clientes.nome}! Passando para lembrar que seu agendamento de *${ag.servicos.nome}* é em cerca de 30 minutos (às ${horaStr}). Até logo!`);
                updateFields.lembrete_30m_enviado = true;
                sent = true;
            } 
            // Regra 60 min (entre 30 e 60 minutos)
            else if (diffMinutes <= 60 && diffMinutes > 30 && !ag.lembrete_60m_enviado) {
                await MegaApi.sendMessage(clienteTel, `⏳ Olá ${ag.clientes.nome}! Passando para lembrar que seu agendamento de *${ag.servicos.nome}* é em cerca de 1 hora (às ${horaStr}). Até logo!`);
                updateFields.lembrete_60m_enviado = true;
                sent = true;
            }
            // Regra 24 horas (entre 23h e 24h = 1380 a 1440 minutos)
            else if (diffMinutes <= 1440 && diffMinutes > 1380 && !ag.lembrete_24h_enviado) {
                const dataStr = agDate.toLocaleDateString('pt-BR');
                await MegaApi.sendMessage(clienteTel, `📅 Olá ${ag.clientes.nome}! Lembrete: você tem um agendamento de *${ag.servicos.nome}* amanhã (${dataStr}) às ${horaStr}.`);
                updateFields.lembrete_24h_enviado = true;
                sent = true;
            }

            if (sent) {
                await supabase.from('agendamentos').update(updateFields).eq('id', ag.id);
                results.push({ id: ag.id, fields: updateFields });
            }
        }

        return res.status(200).json({ message: 'Lembretes processados com sucesso.', processed: results });
    } catch (err: any) {
        console.error("Erro no cron lembretes-clientes:", err);
        return res.status(500).json({ error: 'Erro interno no servidor', details: err.message });
    }
}
