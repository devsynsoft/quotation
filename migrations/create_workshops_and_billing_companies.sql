-- Criação da tabela de oficinas credenciadas
CREATE TABLE IF NOT EXISTS public.workshops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    complement TEXT,
    neighborhood TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criação da tabela de empresas para faturamento
CREATE TABLE IF NOT EXISTS public.billing_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    trading_name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    state_registration TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    complement TEXT,
    neighborhood TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas à tabela purchase_orders para referenciar as novas tabelas
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES public.workshops(id),
ADD COLUMN IF NOT EXISTS billing_company_id UUID REFERENCES public.billing_companies(id);

-- Adicionar índices para melhorar a performance das consultas
CREATE INDEX IF NOT EXISTS idx_workshops_name ON public.workshops(name);
CREATE INDEX IF NOT EXISTS idx_workshops_city_state ON public.workshops(city, state);
CREATE INDEX IF NOT EXISTS idx_workshops_is_active ON public.workshops(is_active);

CREATE INDEX IF NOT EXISTS idx_billing_companies_name ON public.billing_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_billing_companies_cnpj ON public.billing_companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_billing_companies_is_active ON public.billing_companies(is_active);

-- Adicionar permissões RLS (Row Level Security)
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_companies ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso para as novas tabelas
CREATE POLICY "Todos podem visualizar oficinas" 
ON public.workshops FOR SELECT 
USING (true);

CREATE POLICY "Usuários autenticados podem inserir oficinas" 
ON public.workshops FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar oficinas" 
ON public.workshops FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem excluir oficinas" 
ON public.workshops FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Todos podem visualizar empresas de faturamento" 
ON public.billing_companies FOR SELECT 
USING (true);

CREATE POLICY "Usuários autenticados podem inserir empresas de faturamento" 
ON public.billing_companies FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar empresas de faturamento" 
ON public.billing_companies FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem excluir empresas de faturamento" 
ON public.billing_companies FOR DELETE 
TO authenticated 
USING (true);

-- Criar triggers para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workshops_modtime
BEFORE UPDATE ON public.workshops
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_billing_companies_modtime
BEFORE UPDATE ON public.billing_companies
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
