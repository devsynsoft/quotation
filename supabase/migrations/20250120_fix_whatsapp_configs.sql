-- Renomear colunas para usar o prefixo evolution_api
ALTER TABLE whatsapp_configs 
  RENAME COLUMN api_key TO evolution_api_key;

ALTER TABLE whatsapp_configs 
  RENAME COLUMN base_url TO evolution_api_url;

-- Adicionar coluna company_id
ALTER TABLE whatsapp_configs 
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- Remover registros duplicados mantendo apenas o mais recente
DELETE FROM whatsapp_configs a USING whatsapp_configs b
WHERE a.id < b.id 
  AND a.user_id = b.user_id;
