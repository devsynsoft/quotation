-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own company quotation items" ON quotation_items;
DROP POLICY IF EXISTS "Users can insert own company quotation items" ON quotation_items;

-- Create new RLS policies
CREATE POLICY "Users can read quotation items"
  ON quotation_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert quotation items"
  ON quotation_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));

CREATE POLICY "Users can update quotation items"
  ON quotation_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete quotation items"
  ON quotation_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));
