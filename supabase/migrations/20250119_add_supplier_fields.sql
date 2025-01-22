-- Add missing columns to suppliers
ALTER TABLE suppliers 
  ADD COLUMN IF NOT EXISTS area_code TEXT,
  ADD COLUMN IF NOT EXISTS parts_type TEXT,
  ADD COLUMN IF NOT EXISTS specialization TEXT;
