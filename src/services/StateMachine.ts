import { supabase } from '../lib/supabase';
import { ClientFlow } from './ClientFlow';
import { AdminFlow } from './AdminFlow';

export class StateMachine {
    /**
     * Ponto de entrada central. Processa a mensagem e roteia para o fluxo correto.
     */
    static async processMessage(phone: string, message: string) {
        try {
            // 1. Logar a mensagem no Supabase (Log de Chat)
            await supabase.from('logs_chat').insert([{
                telefone: phone,
                mensagem: message,
                direcao: 'inbound'
            }]);

            // 2. Tentar recuperar a sessão atual
            let { data: session } = await supabase.from('sessoes_whatsapp').select('*').eq('telefone', phone).single();

            // 3. Se não existe sessão, criar uma nova
            if (!session) {
                const { data: newSession } = await supabase.from('sessoes_whatsapp').insert([{
                    telefone: phone,
                    current_step: 'START',
                    context_data: {}
                }]).select().single();
                session = newSession;
            }

            // 4. Verificar se o número pertence a um profissional (Admin)
            // Para não consultar a tabela de profissionais toda vez, podemos checar o context_data
            // ou fazer uma query rápida.
            let isAdmin = session.context_data?.is_admin;
            
            if (isAdmin === undefined) {
                const { data: profissional } = await supabase.from('profissionais').select('id').eq('telefone', phone).single();
                isAdmin = !!profissional;
                // Salva na sessão para as próximas mensagens
                await supabase.from('sessoes_whatsapp').update({
                    context_data: { ...session.context_data, is_admin: isAdmin }
                }).eq('telefone', phone);
                session.context_data = { ...session.context_data, is_admin: isAdmin };
            }

            // 5. Roteamento baseado no tipo de usuário
            const msgLower = message.trim().toLowerCase();
            if (msgLower === 'oi' || msgLower === 'olá' || msgLower === 'ola' || msgLower === 'menu') {
                session.current_step = 'START';
                await supabase.from('sessoes_whatsapp').update({ current_step: 'START' }).eq('telefone', phone);
            }

            if (isAdmin) {
                // Se era START de cliente, altera para START de admin
                if (session.current_step === 'START') {
                    session.current_step = 'ADMIN_START';
                }
                await AdminFlow.handle(phone, message, session);
            } else {
                await ClientFlow.handle(phone, message, session);
            }

            // Atualiza o updated_at da sessão
            await supabase.from('sessoes_whatsapp').update({ updated_at: new Date().toISOString() }).eq('telefone', phone);

        } catch (error) {
            console.error(`[StateMachine Error] Falha ao processar mensagem de ${phone}:`, error);
        }
    }
}
