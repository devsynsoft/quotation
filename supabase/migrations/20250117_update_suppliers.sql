-- Create suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  area_code VARCHAR(3) NOT NULL,
  state VARCHAR(2) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_id INTEGER NOT NULL,
  city_id INTEGER NOT NULL,
  street VARCHAR(255) NULL,
  number VARCHAR(20) NULL,
  complement VARCHAR(100) NULL,
  neighborhood VARCHAR(100) NULL,
  zip_code VARCHAR(8) NULL,
  parts_type VARCHAR(20) NOT NULL CHECK (parts_type IN ('new', 'used', 'all')),
  specialization VARCHAR(50) NOT NULL CHECK (
    specialization IN (
      'bodywork',
      'mechanical',
      'lights',
      'tires',
      'finishing',
      'others',
      'all'
    )
  ),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users"
  ON suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update access for authenticated users"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for authenticated users"
  ON suppliers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
