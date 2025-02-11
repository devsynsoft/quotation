-- Create public images table
CREATE TABLE public_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public_images ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all rows
CREATE POLICY "Allow public read access to all images"
  ON public_images FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to insert their own images
CREATE POLICY "Users can insert their own images"
  ON public_images FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their own images"
  ON public_images FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
