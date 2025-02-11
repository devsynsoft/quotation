-- Create public bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-images', 'public-images', true);

-- Allow public read access to all files in the bucket
CREATE POLICY "Allow public read access to all files in public-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'public-images');

-- Allow authenticated users to upload files to public-images
CREATE POLICY "Allow authenticated users to upload files to public-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'public-images');

-- Allow authenticated users to delete their own files from public-images
CREATE POLICY "Allow authenticated users to delete their own files from public-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'public-images' AND owner = auth.uid());
