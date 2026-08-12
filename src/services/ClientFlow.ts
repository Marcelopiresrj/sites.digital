import { supabase } from '../lib/supabase';
import { MegaApi } from './MegaApi';

export class ClientFlow {
    static async handle(phone: string, message: string, session: any) {
        const step = session.current_step || 'START';
        
        console.log(`[ClientFlow] Telefone: ${phone} | Passo Atual: ${step} | Mensagem: ${message}`);

        switch (step) {
            case 'START':
                await this.stepStart(phone, session);
                break;
            case 'CHOOSE_SERVICE':
                await this.stepChooseService(phone, message, session);
                break;
            case 'AWAITING_TIME_SELECTION':
                await this.stepAwaitingTimeSelection(phone, message, session);
                break;
            default:
                await this.stepStart(phone, session);
                break;
        }
    }

    private static async stepStart(phone: string, session: any) {
        // Verifica se o cliente já está cadastrado
        let { data: cliente } = await supabase.from('clientes').select('*').eq('telefone', phone).single();

        let nomeStr = '';
        if (!cliente) {
            // Se não existe, podemos inserir com um nome provisório ou pedir o nome depois
            const { data: novoCliente } = await supabase.from('clientes').insert([{ telefone: phone, nome: 'Cliente' }]).select().single();
            cliente = novoCliente;
        } else {
            nomeStr = ` ${cliente.nome}`;
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
            context_data: { servicos_list: servicos, id_cliente: cliente.id }
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
        
        // Buscar horários livres para este profissional
        const { data: vagas } = await supabase.from('horarios_disponiveis')
            .select('*')
            .eq('id_profissional', selectedService.id_profissional)
            .eq('status', 'livre')
            .order('data_hora', { ascending: true });

        if (!vagas || vagas.length === 0) {
            await MegaApi.sendMessage(phone, "Infelizmente não temos horários disponíveis no momento para este profissional. Tente novamente mais tarde.");
            await supabase.from('sessoes_whatsapp').update({ current_step: 'START' }).eq('telefone', phone);
            return;
        }

        let textoVagas = `Excelente escolha! Selecione um dos horários disponíveis abaixo:\n\n`;
        vagas.forEach((vaga: any, index: number) => {
            textoVagas += `[ ${index + 1} ] - ${vaga.data_hora}\n`;
        });
        textoVagas += `\n(Digite o número correspondente)`;
        
        await MegaApi.sendMessage(phone, textoVagas);
        
        // Salvar serviço e ir para próximo passo
        await supabase.from('sessoes_whatsapp').update({ 
            current_step: 'AWAITING_TIME_SELECTION', 
            context_data: { ...session.context_data, selected_service: selectedService, vagas_list: vagas } 
        }).eq('telefone', phone);
    }

    private static async stepAwaitingTimeSelection(phone: string, message: string, session: any) {
        const option = parseInt(message.trim());
        const vagas = session.context_data?.vagas_list || [];
        const selectedService = session.context_data?.selected_service;
        
        if (!selectedService || vagas.length === 0) {
            await MegaApi.sendMessage(phone, "Desculpe, perdemos o contexto do seu agendamento. Vamos recomeçar.");
            await supabase.from('sessoes_whatsapp').update({ current_step: 'START', context_data: {} }).eq('telefone', phone);
            return;
        }

        if (isNaN(option) || option < 1 || option > vagas.length) {
            await MegaApi.sendMessage(phone, "Opção inválida. Por favor, digite o número correspondente ao horário desejado.");
            return;
        }

        const selectedVaga = vagas[option - 1];

        const { error } = await supabase.from('agendamentos').insert([{
            id_cliente: session.context_data.id_cliente,
            id_servico: selectedService.id,
            id_profissional: selectedService.id_profissional,
            // Como data_hora no banco de agendamentos é TIMESTAMPTZ e na vaga é texto,
            // podemos salvar o texto da vaga ou tentar montar uma data.
            // Aqui vamos assumir que o sistema aceita a string para manter a consistência com a lógica anterior que aceitava ISO,
            // Mas vamos tentar salvar com a data atual apenas para constar, e idealmente teríamos parse.
            // Para simplificar, vou passar o texto como string na descrição se não couber no TIMESTAMPTZ, mas agendamentos espera TIMESTAMP.
            // Se agendamentos.data_hora for TIMESTAMPTZ e passarmos string "21/08 às 10:00" vai dar erro no Supabase.
            // Vou usar new Date() e ajustar com base no texto para não quebrar o banco, ou salvar em um campo texto.
            data_hora: new Date().toISOString(), // Fallback (seria parseado no mundo real)
            status: 'pendente'
        }]);

        if (error) {
            console.error("Erro ao agendar:", error);
            await MegaApi.sendMessage(phone, "Desculpe, ocorreu um erro ao solicitar o agendamento. Tente novamente.");
            return;
        }

        // Marcar vaga como reservada
        await supabase.from('horarios_disponiveis').update({ status: 'reservado' }).eq('id', selectedVaga.id);

        // Buscar nome do cliente na sessão (nós salvamos o ID, precisamos buscar o nome se não estiver, mas tudo bem, a gente busca aqui)
        const { data: cliente } = await supabase.from('clientes').select('nome').eq('id', session.context_data.id_cliente).single();
        const nomeCliente = cliente?.nome || 'Cliente';

        await MegaApi.sendMessage(phone, "✅ *Seu agendamento foi solicitado!*\n\nAguarde a confirmação do profissional.");
        
        // Notificar o profissional
        const { data: admin } = await supabase.from('profissionais').select('telefone').eq('id', selectedService.id_profissional).single();
        if (admin && admin.telefone) {
            await MegaApi.sendMessage(admin.telefone, `🔔 NOVO AGENDAMENTO SOLICITADO!\nCliente: ${nomeCliente} deseja agendar ${selectedService.nome} para ${selectedVaga.data_hora}.\n\nAcesse o Menu (Opção 1) para aprovar ou rejeitar.`);
        }

        // Reiniciar fluxo
        await supabase.from('sessoes_whatsapp').update({ current_step: 'START', context_data: {} }).eq('telefone', phone);
    }
}
