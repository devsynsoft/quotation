/*
  # Add DELETE policies for parts

  1. Changes
    - Add DELETE policy for parts table
    - Add CASCADE deletion for quotation_items when parts are deleted
*/

-- Add DELETE policy for parts
CREATE POLICY "Users can delete own company parts"
  ON parts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = parts.company_id
      AND company_users.user_id = auth.uid()
    )
  );

-- Add CASCADE deletion for quotation_items
ALTER TABLE quotation_items
  DROP CONSTRAINT IF EXISTS quotation_items_part_id_fkey,
  ADD CONSTRAINT quotation_items_part_id_fkey 
    FOREIGN KEY (part_id) 
    REFERENCES parts(id) 
    ON DELETE CASCADE;