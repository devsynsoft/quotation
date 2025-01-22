-- Add user_id column to whatsapp_configs
ALTER TABLE whatsapp_configs 
ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id);

-- Add RLS policies
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
  ON whatsapp_configs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users"
  ON whatsapp_configs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update access for authenticated users"
  ON whatsapp_configs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for authenticated users"
  ON whatsapp_configs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
