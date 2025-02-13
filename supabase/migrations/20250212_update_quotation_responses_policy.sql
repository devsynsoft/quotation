-- Habilita RLS para a tabela quotation_responses
ALTER TABLE quotation_responses ENABLE ROW LEVEL SECURITY;

-- Remove todas as políticas existentes da tabela quotation_responses
DROP POLICY IF EXISTS "Respostas são visíveis apenas para o próprio usuário" ON quotation_responses;
DROP POLICY IF EXISTS "Respostas são visíveis para todos os usuários autenticados" ON quotation_responses;

-- Cria política que permite leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura para usuários autenticados" ON quotation_responses
    FOR SELECT
    TO authenticated
    USING (true);

-- Cria política que permite inserção/atualização/deleção para todos os usuários autenticados
CREATE POLICY "Permitir escrita para usuários autenticados" ON quotation_responses
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
