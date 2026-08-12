-- 1. Renomear a tabela pacientes para clientes
ALTER TABLE pacientes RENAME TO clientes;

-- 2. Renomear a coluna id_paciente para id_cliente na tabela agendamentos
ALTER TABLE agendamentos RENAME COLUMN id_paciente TO id_cliente;

-- 3. Criar a nova tabela de disponibilidade do profissional
CREATE TABLE disponibilidade_profissional (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_profissional UUID REFERENCES profissionais(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL, -- 0 = Domingo, 1 = Segunda, 2 = Terça, ..., 6 = Sábado
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS e criar policies básicas para a nova tabela
ALTER TABLE disponibilidade_profissional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disponibilidade é visível para todos" ON disponibilidade_profissional
    FOR SELECT USING (true);

CREATE POLICY "Admin pode inserir e editar disponibilidade" ON disponibilidade_profissional
    FOR ALL USING (true) WITH CHECK (true);
