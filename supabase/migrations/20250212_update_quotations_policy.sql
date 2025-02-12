-- Habilita RLS para a tabela quotations
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- Remove todas as políticas existentes da tabela quotations
DROP POLICY IF EXISTS "Cotações são visíveis apenas para o próprio usuário" ON quotations;
DROP POLICY IF EXISTS "Cotações são visíveis para todos os usuários autenticados" ON quotations;

-- Cria política que permite leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura para usuários autenticados" ON quotations
    FOR SELECT
    TO authenticated
    USING (true);

-- Cria política que permite inserção/atualização/deleção para todos os usuários autenticados
CREATE POLICY "Permitir escrita para usuários autenticados" ON quotations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
