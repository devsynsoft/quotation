-- Add company_id to quotation_items
ALTER TABLE quotation_items ADD COLUMN company_id uuid REFERENCES companies(id);

-- Enable RLS on quotation_items
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for quotation_items
CREATE POLICY "Users can read own company quotation items"
  ON quotation_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = quotation_items.company_id
      AND company_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own company quotation items"
  ON quotation_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = quotation_items.company_id
      AND company_users.user_id = auth.uid()
    )
  );