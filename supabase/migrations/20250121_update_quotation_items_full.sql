-- Atualiza a tabela quotation_items com todos os campos necessários
ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS operation text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS part_type text,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS unit_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS total_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS painting_hours numeric(5,2);

-- Adiciona coluna cover_image na tabela quotation_requests
ALTER TABLE quotation_requests ADD COLUMN IF NOT EXISTS cover_image text;
