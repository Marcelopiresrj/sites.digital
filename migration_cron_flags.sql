-- Adicionar colunas de controle de envio de lembretes e resumos na tabela agendamentos
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS lembrete_24h_enviado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lembrete_60m_enviado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lembrete_30m_enviado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS resumo_diario_enviado BOOLEAN DEFAULT false;
