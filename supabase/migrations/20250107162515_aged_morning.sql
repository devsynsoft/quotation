/*
  # Add vehicle fields and storage bucket

  1. Changes
    - Add new fields to vehicles table:
      - manufacturing_year (integer)
      - model_year (integer) 
      - license_plate (text)
    - Create vehicle-images storage bucket

  2. Updates
    - Make chassis optional since we'll use license_plate as main identifier
*/

-- Add new columns to vehicles table
ALTER TABLE vehicles 
  ADD COLUMN manufacturing_year INTEGER,
  ADD COLUMN model_year INTEGER,
  ADD COLUMN license_plate TEXT UNIQUE;

-- Update chassis to be optional
ALTER TABLE vehicles 
  ALTER COLUMN chassis DROP NOT NULL;

-- Create storage bucket for vehicle images
INSERT INTO storage.buckets (id, name)
VALUES ('vehicle-images', 'vehicle-images');

-- Set up storage policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload vehicle images"
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'vehicle-images');

-- Allow authenticated users to read vehicle images
CREATE POLICY "Allow authenticated users to read vehicle images"
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'vehicle-images');