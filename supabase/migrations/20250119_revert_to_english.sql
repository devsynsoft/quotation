-- Revert to original English schema
DROP TABLE IF EXISTS cotacoes CASCADE;
DROP TABLE IF EXISTS veiculos CASCADE;
DROP TABLE IF EXISTS fornecedores CASCADE;
DROP TABLE IF EXISTS pecas CASCADE;

-- Restore original tables if they don't exist
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  chassis TEXT NOT NULL UNIQUE,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id uuid REFERENCES vehicles(id),
  code TEXT,
  description TEXT NOT NULL,
  part_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  area_code TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id uuid REFERENCES suppliers(id),
  vehicle_id uuid REFERENCES vehicles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id uuid REFERENCES quotations(id),
  part_id uuid REFERENCES parts(id),
  supplier_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Parts policies
CREATE POLICY "Users can read own parts"
  ON parts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parts"
  ON parts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parts"
  ON parts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own parts"
  ON parts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Suppliers policies
CREATE POLICY "Users can read own suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Quotations policies
CREATE POLICY "Users can read own quotations"
  ON quotations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quotations"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotations"
  ON quotations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quotations"
  ON quotations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Quotation items policies
CREATE POLICY "Users can read quotation items"
  ON quotation_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert quotation items"
  ON quotation_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));

CREATE POLICY "Users can update quotation items"
  ON quotation_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete quotation items"
  ON quotation_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotations q
    WHERE q.id = quotation_items.quotation_id
    AND q.user_id = auth.uid()
  ));
