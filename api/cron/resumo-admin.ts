import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../src/lib/supabase';
import { MegaApi } from '../../src/services/MegaApi';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Datas para filtrar o dia de hoje
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // Buscar agendamentos de hoje
        const { data: agendamentos, error } = await supabase
            .from('agendamentos')
            .select(`
                id, data_hora, resumo_diario_enviado, id_profissional,
                clientes (nome),
                servicos (nome),
                profissionais (nome, telefone)
            `)
            .eq('status', 'confirmado')
            .eq('resumo_diario_enviado', false)
            .gte('data_hora', startOfDay.toISOString())
            .lte('data_hora', endOfDay.toISOString())
            .order('data_hora', { ascending: true });

        if (error) throw error;

        if (!agendamentos || agendamentos.length === 0) {
            return res.status(200).json({ message: 'Nenhum resumo pendente para hoje.' });
        }

        // Agrupar por profissional
        const agendaPorProfissional: { [key: string]: any } = {};

        for (const ag of agendamentos) {
            const profissional: any = ag.profissionais;
            const cliente: any = ag.clientes;
            const servico: any = ag.servicos;
            const idProfissional = ag.id_profissional;

            if (!agendaPorProfissional[idProfissional]) {
                agendaPorProfissional[idProfissional] = {
                    telefone: profissional.telefone,
                    nome: profissional.nome,
                    agendamentos: [],
                    ids: []
                };
            }
            agendaPorProfissional[idProfissional].agendamentos.push({
                data_hora: ag.data_hora,
                clienteNome: cliente.nome,
                servicoNome: servico.nome
            });
            agendaPorProfissional[idProfissional].ids.push(ag.id);
        }

        const results = [];

        // Enviar resumos
        for (const profId in agendaPorProfissional) {
            const profInfo = agendaPorProfissional[profId];
            let texto = `☕ Bom dia, ${profInfo.nome}! Aqui está sua agenda de hoje:\n\n`;

            for (const ag of profInfo.agendamentos) {
                const horaStr = new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                texto += `${horaStr} - ${ag.clienteNome} (${ag.servicoNome})\n`;
            }

            // Envia para o admin
            await MegaApi.sendMessage(profInfo.telefone, texto);

            // Marca no banco
            for (const agId of profInfo.ids) {
                await supabase.from('agendamentos').update({ resumo_diario_enviado: true }).eq('id', agId);
            }

            results.push({ profissional: profInfo.nome, count: profInfo.agendamentos.length });
        }

        return res.status(200).json({ message: 'Resumos diários processados com sucesso.', processed: results });
    } catch (err: any) {
        console.error("Erro no cron resumo-admin:", err);
        return res.status(500).json({ error: 'Erro interno no servidor', details: err.message });
    }
}
