/*
  # Add companies and WhatsApp configuration

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text)
      - `document` (text, unique)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `company_users`
      - Links users to companies
      - Allows users to belong to multiple companies
      
    - `whatsapp_configs`
      - Stores Evolution API configuration per company
      
  2. Security
    - Enable RLS on all tables
    - Add policies for company access
*/

-- Companies table
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company Users junction table
CREATE TABLE company_users (
  company_id uuid REFERENCES companies(id),
  user_id uuid REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, user_id)
);

-- WhatsApp configuration table
CREATE TABLE whatsapp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  evolution_api_url TEXT NOT NULL,
  evolution_api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id)
);

-- Add company_id to existing tables
ALTER TABLE vehicles ADD COLUMN company_id uuid REFERENCES companies(id);
ALTER TABLE parts ADD COLUMN company_id uuid REFERENCES companies(id);
ALTER TABLE suppliers ADD COLUMN company_id uuid REFERENCES companies(id);
ALTER TABLE quotations ADD COLUMN company_id uuid REFERENCES companies(id);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- Policies for companies
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
      AND company_users.user_id = auth.uid()
    )
  );

-- Policies for company_users
CREATE POLICY "Users can view company members"
  ON company_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policies for whatsapp_configs
CREATE POLICY "Users can view their company's WhatsApp config"
  ON whatsapp_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = whatsapp_configs.company_id
      AND company_users.user_id = auth.uid()
      AND company_users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update their company's WhatsApp config"
  ON whatsapp_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = whatsapp_configs.company_id
      AND company_users.user_id = auth.uid()
      AND company_users.role = 'admin'
    )
  );

-- Update triggers
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_configs_updated_at
    BEFORE UPDATE ON whatsapp_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();