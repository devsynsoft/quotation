-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON whatsapp_configs;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON whatsapp_configs;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON whatsapp_configs;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON whatsapp_configs;

-- Recreate the table to ensure correct structure
DROP TABLE IF EXISTS whatsapp_configs CASCADE;
CREATE TABLE whatsapp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    base_url TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- Create policies with simpler conditions
CREATE POLICY "whatsapp_configs_select_policy" 
    ON whatsapp_configs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "whatsapp_configs_insert_policy" 
    ON whatsapp_configs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "whatsapp_configs_update_policy" 
    ON whatsapp_configs FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "whatsapp_configs_delete_policy" 
    ON whatsapp_configs FOR DELETE 
    USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON whatsapp_configs TO authenticated;
GRANT USAGE ON SEQUENCE whatsapp_configs_id_seq TO authenticated;

-- Add unique constraint to prevent multiple configs per user
ALTER TABLE whatsapp_configs ADD CONSTRAINT whatsapp_configs_user_id_key UNIQUE (user_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
