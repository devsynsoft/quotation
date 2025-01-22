-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view company members" ON company_users;
DROP POLICY IF EXISTS "Users can view company users" ON company_users;
DROP POLICY IF EXISTS "Users can view own company memberships" ON company_users;

-- Create new policies without recursion
-- 1. Allow users to view company_users entries where they are members
CREATE POLICY "view_as_company_member"
ON company_users FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  company_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE user_id = auth.uid()
  )
);

-- 2. Allow inserting new company_users only by company admins
CREATE POLICY "insert_as_company_admin"
ON company_users FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM company_users 
    WHERE company_id = NEW.company_id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- 3. Allow company admins to delete company_users
CREATE POLICY "delete_as_company_admin"
ON company_users FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM company_users 
    WHERE company_id = company_users.company_id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- 4. Special policy for the first company admin
CREATE POLICY "insert_first_company_admin"
ON company_users FOR INSERT
TO authenticated
WITH CHECK (
  NEW.role = 'admin' AND 
  NEW.user_id = auth.uid() AND 
  NOT EXISTS (
    SELECT 1 
    FROM company_users 
    WHERE company_id = NEW.company_id
  )
);
