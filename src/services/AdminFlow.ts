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
            case 'AWAITING_APPROVAL':
                await this.stepAwaitingApproval(phone, message, session);
                break;
            case 'ADD_SLOTS':
                await this.stepAddSlots(phone, message, session);
                break;
            case 'CANCEL_APPOINTMENT':
                await this.stepCancelAppointment(phone, message, session);
                break;
            case 'RESCHEDULE_APPOINTMENT':
                await this.stepRescheduleAppointment(phone, message, session);
                break;
            case 'RESCHEDULE_DATETIME':
                await this.stepRescheduleDatetime(phone, message, session);
                break;
            default:
                await this.stepAdminStart(phone, session);
                break;
        }
    }

    private static async stepAdminStart(phone: string, session: any) {
        const { data: profissional } = await supabase.from('profissionais').select('*').eq('telefone', phone).single();
        
        const texto = `Olá, *${profissional.nome}* (Profissional)!\n\n` +
                      `[ 1 ] - Ver Agendamentos Pendentes (Aprovar)\n` +
                      `[ 2 ] - Ver Agenda Completa (Confirmados)\n` +
                      `[ 3 ] - Adicionar Horários Disponíveis\n` +
                      `[ 4 ] - Cancelar Agendamento\n` +
                      `[ 5 ] - Remarcar Agendamento\n` +
                      `[ 6 ] - Adicionar Serviço\n\n` +
                      `Digite o número da opção desejada:`;

        await MegaApi.sendMessage(phone, texto);

        await supabase.from('sessoes_whatsapp').update({
            current_step: 'ADMIN_MENU',
            context_data: { id_profissional: profissional.id }
        }).eq('telefone', phone);
    }

    private static async stepAdminMenu(phone: string, message: string, session: any) {
        const option = message.trim();
        const idProfissional = session.context_data.id_profissional;

        if (option === '1') {
            const { data: agendamentos } = await supabase.from('agendamentos')
                .select(`id, data_hora, status, clientes (nome)`)
                .eq('id_profissional', idProfissional)
                .eq('status', 'pendente')
                .order('data_hora', { ascending: true });

            if (!agendamentos || agendamentos.length === 0) {
                await MegaApi.sendMessage(phone, "Nenhum agendamento pendente.");
                await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
                await this.stepAdminStart(phone, session);
            } else {
                let texto = "⏳ *Agendamentos Pendentes:*\n\n";
                agendamentos.forEach((a: any, index: number) => {
                    const dataFormatada = new Date(a.data_hora).toLocaleString('pt-BR');
                    texto += `[ ${index + 1} ] - ${a.clientes.nome} - ${dataFormatada}\n`;
                });
                texto += `\nDigite o número do agendamento para APROVAR, ou digite 0 para voltar.`;
                
                await supabase.from('sessoes_whatsapp').update({ 
                    current_step: 'AWAITING_APPROVAL',
                    context_data: { ...session.context_data, pendentes: agendamentos }
                }).eq('telefone', phone);
                
                await MegaApi.sendMessage(phone, texto);
            }
        } 
        else if (option === '2') {
            const { data: agendamentos } = await supabase.from('agendamentos')
                .select(`id, data_hora, status, clientes (nome)`)
                .eq('id_profissional', idProfissional)
                .eq('status', 'confirmado')
                .order('data_hora', { ascending: true });

            if (!agendamentos || agendamentos.length === 0) {
                await MegaApi.sendMessage(phone, "Sua agenda está vazia no momento.");
            } else {
                let texto = "✅ *Agenda Completa (Confirmados):*\n\n";
                agendamentos.forEach((a: any) => {
                    const dataFormatada = new Date(a.data_hora).toLocaleString('pt-BR');
                    texto += `- ${a.clientes.nome} - ${dataFormatada}\n`;
                });
                await MegaApi.sendMessage(phone, texto);
            }
            await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
            await this.stepAdminStart(phone, session);
        } 
        else if (option === '3') {
            await MegaApi.sendMessage(phone, "Para cadastrar vagas:\nDigite a data e o horário disponível.\nExemplo: 21/08 10:00\n\nOu digite 0 para voltar ao menu.");
            await supabase.from('sessoes_whatsapp').update({ current_step: 'ADD_SLOTS' }).eq('telefone', phone);
        }
        else if (option === '4') {
            const { data: agendamentos } = await supabase.from('agendamentos')
                .select(`id, data_hora, status, clientes (nome)`)
                .eq('id_profissional', idProfissional)
                .eq('status', 'confirmado')
                .order('data_hora', { ascending: true });

            if (!agendamentos || agendamentos.length === 0) {
                await MegaApi.sendMessage(phone, "Nenhum agendamento confirmado para cancelar.");
                await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
                await this.stepAdminStart(phone, session);
            } else {
                let texto = "❌ *Cancelar Agendamento:*\n\n";
                agendamentos.forEach((a: any, index: number) => {
                    const dataFormatada = new Date(a.data_hora).toLocaleString('pt-BR');
                    texto += `[ ${index + 1} ] - ${a.clientes.nome} - ${dataFormatada}\n`;
                });
                texto += `\nDigite o número para CANCELAR, ou 0 para voltar.`;
                
                await supabase.from('sessoes_whatsapp').update({ 
                    current_step: 'CANCEL_APPOINTMENT',
                    context_data: { ...session.context_data, confirmados: agendamentos }
                }).eq('telefone', phone);
                await MegaApi.sendMessage(phone, texto);
            }
        }
        else if (option === '5') {
            const { data: agendamentos } = await supabase.from('agendamentos')
                .select(`id, data_hora, status, clientes (nome)`)
                .eq('id_profissional', idProfissional)
                .eq('status', 'confirmado')
                .order('data_hora', { ascending: true });

            if (!agendamentos || agendamentos.length === 0) {
                await MegaApi.sendMessage(phone, "Nenhum agendamento confirmado para remarcar.");
                await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
                await this.stepAdminStart(phone, session);
            } else {
                let texto = "🔄 *Remarcar Agendamento:*\n\n";
                agendamentos.forEach((a: any, index: number) => {
                    const dataFormatada = new Date(a.data_hora).toLocaleString('pt-BR');
                    texto += `[ ${index + 1} ] - ${a.clientes.nome} - ${dataFormatada}\n`;
                });
                texto += `\nDigite o número para REMARCAR, ou 0 para voltar.`;
                
                await supabase.from('sessoes_whatsapp').update({ 
                    current_step: 'RESCHEDULE_APPOINTMENT',
                    context_data: { ...session.context_data, confirmados: agendamentos }
                }).eq('telefone', phone);
                await MegaApi.sendMessage(phone, texto);
            }
        }
        else if (option === '6') {
            await MegaApi.sendMessage(phone, "Acesse o painel web (em breve) ou edite o banco de dados diretamente para adicionar novos serviços.");
            await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
            await this.stepAdminStart(phone, session);
        }
        else {
            await MegaApi.sendMessage(phone, "Opção inválida.");
        }
    }

    private static async stepAwaitingApproval(phone: string, message: string, session: any) {
        const option = parseInt(message.trim());
        if (option === 0) {
            await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
            return this.stepAdminStart(phone, session);
        }

        const pendentes = session.context_data?.pendentes || [];
        if (isNaN(option) || option < 1 || option > pendentes.length) {
            await MegaApi.sendMessage(phone, "Opção inválida.");
            return;
        }

        const agendamento = pendentes[option - 1];
        await supabase.from('agendamentos').update({ status: 'confirmado' }).eq('id', agendamento.id);

        await MegaApi.sendMessage(phone, "Agendamento APROVADO com sucesso!");

        // Notificar cliente
        const { data: cliente } = await supabase.from('clientes').select('telefone').eq('nome', agendamento.clientes.nome).limit(1).single();
        if (cliente?.telefone) {
            const dataFormatada = new Date(agendamento.data_hora).toLocaleString('pt-BR');
            await MegaApi.sendMessage(cliente.telefone, `✅ Olá! Seu agendamento para o dia ${dataFormatada} foi confirmado pelo profissional!`);
        }

        await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
        await this.stepAdminStart(phone, session);
    }

    private static async stepAddSlots(phone: string, message: string, session: any) {
        if (message.trim() === '0') {
            await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
            return this.stepAdminStart(phone, session);
        }

        const dataHoraVaga = message.trim();
        
        // Simples validação de tamanho mínimo (esperando algo como "21/08 10:00")
        if (dataHoraVaga.length >= 8) {
            await supabase.from('horarios_disponiveis').insert([{
                id_profissional: session.context_data.id_profissional,
                data_hora: dataHoraVaga,
                status: 'livre'
            }]);
            
            await MegaApi.sendMessage(phone, `✅ Horário [ ${dataHoraVaga} ] cadastrado com sucesso!\n\nDigite outro horário para adicionar mais vagas ou digite 0 para voltar.`);
            // Mantém no mesmo step para loop
        } else {
            await MegaApi.sendMessage(phone, "Formato inválido. Tente algo como: 21/08 10:00\nOu digite 0 para voltar.");
        }
    }

    private static async stepCancelAppointment(phone: string, message: string, session: any) {
        const option = parseInt(message.trim());
        if (option === 0) {
            await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
            return this.stepAdminStart(phone, session);
        }

        const confirmados = session.context_data?.confirmados || [];
        if (isNaN(option) || option < 1 || option > confirmados.length) {
            await MegaApi.sendMessage(phone, "Opção inválida.");
            return;
        }

        const agendamento = confirmados[option - 1];
        await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', agendamento.id);

        await MegaApi.sendMessage(phone, "Agendamento CANCELADO com sucesso!");

        // Notificar cliente
        const { data: cliente } = await supabase.from('clientes').select('telefone').eq('nome', agendamento.clientes.nome).limit(1).single();
        if (cliente?.telefone) {
            const dataFormatada = new Date(agendamento.data_hora).toLocaleString('pt-BR');
            await MegaApi.sendMessage(cliente.telefone, `❌ Olá! O profissional precisou cancelar o seu agendamento do dia ${dataFormatada}. Por favor, entre em contato para remarcar.`);
        }

        await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
        await this.stepAdminStart(phone, session);
    }

    private static async stepRescheduleAppointment(phone: string, message: string, session: any) {
        const option = parseInt(message.trim());
        if (option === 0) {
            await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START' }).eq('telefone', phone);
            return this.stepAdminStart(phone, session);
        }

        const confirmados = session.context_data?.confirmados || [];
        if (isNaN(option) || option < 1 || option > confirmados.length) {
            await MegaApi.sendMessage(phone, "Opção inválida.");
            return;
        }

        const agendamento = confirmados[option - 1];
        
        await supabase.from('sessoes_whatsapp').update({ 
            current_step: 'RESCHEDULE_DATETIME',
            context_data: { ...session.context_data, agendamento_remarcar: agendamento }
        }).eq('telefone', phone);
        
        await MegaApi.sendMessage(phone, `Você escolheu remarcar o agendamento de ${agendamento.clientes.nome}.\nDigite a nova data e horário (Ex: 25/08 às 15:00):`);
    }

    private static async stepRescheduleDatetime(phone: string, message: string, session: any) {
        const agendamento = session.context_data?.agendamento_remarcar;
        
        let dataAgendamento = new Date();
        const match = message.match(/(\d{1,2})\/(\d{1,2})[^0-9]+(\d{1,2}):(\d{1,2})/);
        if (match) {
            const [, dia, mes, hora, minuto] = match;
            dataAgendamento.setMonth(parseInt(mes) - 1, parseInt(dia));
            dataAgendamento.setHours(parseInt(hora), parseInt(minuto), 0, 0);
        } else {
            dataAgendamento.setDate(dataAgendamento.getDate() + 1);
        }

        await supabase.from('agendamentos').update({ data_hora: dataAgendamento.toISOString() }).eq('id', agendamento.id);

        await MegaApi.sendMessage(phone, "Agendamento REMARCADO com sucesso!");

        // Notificar cliente
        const { data: cliente } = await supabase.from('clientes').select('telefone').eq('nome', agendamento.clientes.nome).limit(1).single();
        if (cliente?.telefone) {
            const dataFormatada = dataAgendamento.toLocaleString('pt-BR');
            await MegaApi.sendMessage(cliente.telefone, `🔄 Olá! O profissional remarcou o seu agendamento para o dia ${dataFormatada}.`);
        }

        await supabase.from('sessoes_whatsapp').update({ current_step: 'ADMIN_START', context_data: { id_profissional: session.context_data.id_profissional } }).eq('telefone', phone);
        await this.stepAdminStart(phone, session);
    }
}
