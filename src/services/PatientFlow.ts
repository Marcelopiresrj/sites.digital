import { supabase } from '../lib/supabase';
import { MegaApi } from './MegaApi';

export class PatientFlow {
    static async handle(phone: string, message: string, session: any) {
        const step = session.current_step || 'START';
        
        console.log(`[PatientFlow] Telefone: ${phone} | Passo Atual: ${step} | Mensagem: ${message}`);

        switch (step) {
            case 'START':
                await this.stepStart(phone, session);
                break;
            case 'CHOOSE_SERVICE':
                await this.stepChooseService(phone, message, session);
                break;
            // Opcional: expandir para CHOOSE_TIME ou diretamente confirmar
            default:
                await this.stepStart(phone, session);
                break;
        }
    }

    private static async stepStart(phone: string, session: any) {
        // Verifica se o paciente já está cadastrado
        let { data: paciente } = await supabase.from('pacientes').select('*').eq('telefone', phone).single();

        let nomeStr = '';
        if (!paciente) {
            // Se não existe, podemos inserir com um nome provisório ou pedir o nome depois
            const { data: novoPaciente } = await supabase.from('pacientes').insert([{ telefone: phone, nome: 'Paciente' }]).select().single();
            paciente = novoPaciente;
        } else {
            nomeStr = ` ${paciente.nome}`;
        }

        // Buscar serviços ativos
        const { data: servicos } = await supabase.from('servicos').select('*').limit(15);
        
        let texto = `Olá${nomeStr}! Bem-vindo ao AgendaZap. Como posso ajudar hoje?\n\n`;
        texto += `Responda com o *NÚMERO* do serviço que deseja agendar:\n\n`;
        
        if (servicos && servicos.length > 0) {
            servicos.forEach((s: any, index: number) => {
                texto += `${index + 1}. ${s.nome} (${s.duracao_minutos} min)\n`;
            });
            texto += `\n0. Falar com atendente`;
        } else {
            texto += `No momento não temos serviços configurados. Aguarde um instante!`;
        }

        await MegaApi.sendMessage(phone, texto);

        // Atualizar sessão
        await supabase.from('sessoes_whatsapp').update({
            current_step: 'CHOOSE_SERVICE',
            context_data: { servicos_list: servicos, id_paciente: paciente.id }
        }).eq('telefone', phone);
    }

    private static async stepChooseService(phone: string, message: string, session: any) {
        const option = parseInt(message.trim());
        const servicos = session.context_data?.servicos_list || [];

        if (isNaN(option) || option < 0 || option > servicos.length) {
            await MegaApi.sendMessage(phone, "Opção inválida. Por favor, digite o número correspondente ao serviço desejado.");
            return;
        }

        if (option === 0) {
            await MegaApi.sendMessage(phone, "Ok! Um dos nossos atendentes falará com você em breve.");
            await supabase.from('sessoes_whatsapp').update({ current_step: 'TALKING_TO_HUMAN' }).eq('telefone', phone);
            return;
        }

        const selectedService = servicos[option - 1];
        
        // Simular a criação do agendamento para o amanhã neste horário
        const dataAgendamento = new Date();
        dataAgendamento.setDate(dataAgendamento.getDate() + 1);

        const { error } = await supabase.from('agendamentos').insert([{
            id_paciente: session.context_data.id_paciente,
            id_servico: selectedService.id,
            id_profissional: selectedService.id_profissional,
            data_hora: dataAgendamento.toISOString(),
            status: 'pendente'
        }]);

        if (error) {
            console.error("Erro ao agendar:", error);
            await MegaApi.sendMessage(phone, "Desculpe, ocorreu um erro ao agendar. Tente novamente mais tarde.");
            return;
        }

        await MegaApi.sendMessage(phone, `Perfeito! Seu agendamento para *${selectedService.nome}* foi solicitado com sucesso. Aguarde a confirmação do profissional!`);
        
        // Reiniciar fluxo
        await supabase.from('sessoes_whatsapp').update({ current_step: 'START', context_data: {} }).eq('telefone', phone);
    }
}
