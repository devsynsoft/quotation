-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view company users" ON company_users;

-- Create a simpler, non-recursive policy
CREATE POLICY "Users can view own company memberships"
  ON company_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 
    FROM company_users cu 
    WHERE cu.company_id = company_users.company_id 
    AND cu.user_id = auth.uid() 
    AND cu.role = 'admin'
  ));
