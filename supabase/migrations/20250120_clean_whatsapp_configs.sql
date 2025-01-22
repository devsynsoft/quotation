-- Delete duplicate records keeping only the most recent one
WITH latest_config AS (
  SELECT DISTINCT ON (user_id) *
  FROM whatsapp_configs
  ORDER BY user_id, created_at DESC
)
DELETE FROM whatsapp_configs
WHERE id NOT IN (SELECT id FROM latest_config);
