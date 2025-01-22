-- Drop existing policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON quotations;
DROP POLICY IF EXISTS "Users can read own quotations" ON quotations;
DROP POLICY IF EXISTS "Users can insert own quotations" ON quotations;
DROP POLICY IF EXISTS "Users can update own quotations" ON quotations;
DROP POLICY IF EXISTS "Users can delete own quotations" ON quotations;

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
