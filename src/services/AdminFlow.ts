import { supabase } from '../lib/supabase';
import { MegaApi } from './MegaApi';

export class AdminFlow {
    static async handle(phone: string, message: string, session: any) {
        const step = session.current_step || 'ADMIN_START';
        
        console.log(`[AdminFlow] Admin: ${phone} | Passo Atual: ${step} | Mensagem: ${message}`);

        switch (step) {
            case 'ADMIN_START':
                await this.stepAdminStart(phone, session);
                break;
            case 'ADMIN_MENU':
                await this.stepAdminMenu(phone, message, session);
                break;
            default:
                await this.stepAdminStart(phone, session);
                break;
        }
    }

    private static async stepAdminStart(phone: string, session: any) {
        const { data: profissional } = await supabase.from('profissionais').select('*').eq('telefone', phone).single();
        
        const texto = `Olá, *${profissional.nome}* (Admin)!\n\n` +
                      `1. Ver Agendamentos Pendentes\n` +
                      `2. Adicionar Serviço\n` +
                      `3. Sair`;

        await MegaApi.sendMessage(phone, texto);

        await supabase.from('sessoes_whatsapp').update({
            current_step: 'ADMIN_MENU',
            context_data: { id_profissional: profissional.id }
        }).eq('telefone', phone);
    }

    private static async stepAdminMenu(phone: string, message: string, session: any) {
        const option = message.trim();

        if (option === '1') {
            const { data: agendamentos } = await supabase.from('agendamentos')
                .select(`id, data_hora, status, pacientes (nome)`)
                .eq('id_profissional', session.context_data.id_profissional)
                .eq('status', 'pendente');

            if (!agendamentos || agendamentos.length === 0) {
                await MegaApi.sendMessage(phone, "Você não tem agendamentos pendentes no momento.");
            } else {
                let texto = "📅 *Agendamentos Pendentes:*\n\n";
                agendamentos.forEach((a: any) => {
                    texto += `- ${a.pacientes.nome} (em ${new Date(a.data_hora).toLocaleString()})\n`;
                });
                await MegaApi.sendMessage(phone, texto);
            }
        } 
        else if (option === '2') {
            await MegaApi.sendMessage(phone, "Para adicionar um serviço, por favor acesse o painel web.");
        } 
        else if (option === '3') {
            await MegaApi.sendMessage(phone, "Atendimento encerrado.");
        }
        else {
            await MegaApi.sendMessage(phone, "Opção inválida.");
        }

        // Reinicia o menu admin
        await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
        if (option !== '3') {
            // Re-enviar menu se não escolheu sair
            await this.stepAdminStart(phone, session);
        }
    }
}
