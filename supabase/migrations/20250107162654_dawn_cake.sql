/*
  # Fix storage bucket and policies

  1. Changes
    - Create storage bucket if not exists
    - Update storage policies with proper user ownership
*/

-- Create storage bucket if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vehicle-images'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('vehicle-images', 'vehicle-images', true);
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload own vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own vehicle images" ON storage.objects;

-- Create new policies
CREATE POLICY "Users can upload own vehicle images"
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'vehicle-images'
);

CREATE POLICY "Users can read vehicle images"
ON storage.objects FOR SELECT TO authenticated 
USING (
  bucket_id = 'vehicle-images'
);