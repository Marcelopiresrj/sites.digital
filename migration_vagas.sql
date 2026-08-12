-- Criar a tabela de vagas exatas (horarios_disponiveis)
CREATE TABLE IF NOT EXISTS horarios_disponiveis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_profissional UUID REFERENCES profissionais(id) ON DELETE CASCADE,
    data_hora TEXT NOT NULL, -- Ex: "21/08 às 10:00"
    status TEXT NOT NULL DEFAULT 'livre', -- "livre" ou "reservado"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE horarios_disponiveis ENABLE ROW LEVEL SECURITY;

-- Permitir leitura de vagas livres para todos
CREATE POLICY "Vagas são visíveis para todos" ON horarios_disponiveis
    FOR SELECT USING (true);

-- Permitir qualquer pessoa de inserir/atualizar por enquanto,
-- já que o bot vai precisar atualizar o status para "reservado"
CREATE POLICY "Acesso total" ON horarios_disponiveis
    FOR ALL USING (true) WITH CHECK (true);
