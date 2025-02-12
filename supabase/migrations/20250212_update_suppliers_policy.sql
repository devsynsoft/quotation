-- Habilita RLS para a tabela suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Remove todas as políticas existentes da tabela suppliers
DROP POLICY IF EXISTS "Fornecedores são visíveis apenas para o próprio usuário" ON suppliers;
DROP POLICY IF EXISTS "Fornecedores são visíveis para todos os usuários autenticados" ON suppliers;

-- Cria política que permite leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura para usuários autenticados" ON suppliers
    FOR SELECT
    TO authenticated
    USING (true);

-- Cria política que permite inserção/atualização/deleção para todos os usuários autenticados
CREATE POLICY "Permitir escrita para usuários autenticados" ON suppliers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
