/*
  # Update vehicle schema

  1. Changes
    - Remove old year column
    - Add manufacturing_year and model_year columns
    - Add license_plate column
    - Make chassis optional
*/

-- Drop old year column
ALTER TABLE vehicles DROP COLUMN IF EXISTS year;

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'manufacturing_year'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN manufacturing_year INTEGER NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'model_year'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN model_year INTEGER NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'license_plate'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN license_plate TEXT UNIQUE;
  END IF;
END $$;

-- Make chassis optional if it's not already
ALTER TABLE vehicles ALTER COLUMN chassis DROP NOT NULL;