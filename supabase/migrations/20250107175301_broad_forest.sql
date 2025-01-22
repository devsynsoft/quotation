/*
  # Add active status to companies

  1. Changes
    - Add active column to companies table
    - Set default value to true
    - Update existing companies to be active
*/

ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Update existing companies to be active
UPDATE companies SET active = true WHERE active IS NULL;