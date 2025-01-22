-- Adiciona campo estado na tabela companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS state VARCHAR(2) NOT NULL DEFAULT 'SP';
