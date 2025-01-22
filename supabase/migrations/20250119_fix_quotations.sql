-- Add user_id to quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Drop existing policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON quotations;

-- Create new RLS policies
CREATE POLICY "Users can read own quotations"
  ON quotations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own quotations"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own quotations"
  ON quotations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own quotations"
  ON quotations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
