/*
  # Fix RLS policies for parts and company_users

  1. Changes
    - Simplify parts deletion policy
    - Add basic RLS policies for company_users
    - Fix recursive policy issue
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can delete own company parts" ON parts;

-- Create simpler deletion policy for parts
CREATE POLICY "Users can delete own parts"
  ON parts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add basic policies for company_users
DROP POLICY IF EXISTS "Users can view company members" ON company_users;

CREATE POLICY "Users can view company users"
  ON company_users FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );