/*
  # Fix storage policies for vehicle images

  1. Changes
    - Update storage policies to properly handle user ownership
    - Add owner_id column to objects table
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle images" ON storage.objects;

-- Create new policies with proper user ownership
CREATE POLICY "Users can upload own vehicle images"
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'vehicle-images' AND
  owner = auth.uid()
);

CREATE POLICY "Users can read own vehicle images"
ON storage.objects FOR SELECT TO authenticated 
USING (
  bucket_id = 'vehicle-images' AND
  owner = auth.uid()
);