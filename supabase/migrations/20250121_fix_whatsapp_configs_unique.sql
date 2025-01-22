-- Remove duplicates keeping only the latest config per user
WITH latest_configs AS (
  SELECT DISTINCT ON (user_id) *
  FROM whatsapp_configs
  ORDER BY user_id, created_at DESC
)
DELETE FROM whatsapp_configs
WHERE id NOT IN (SELECT id FROM latest_configs);

-- Add unique constraint on user_id
ALTER TABLE whatsapp_configs
ADD CONSTRAINT whatsapp_configs_user_id_key UNIQUE (user_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
