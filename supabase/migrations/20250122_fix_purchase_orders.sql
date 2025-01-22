-- Primeiro, vamos dropar as tabelas se elas existirem
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;

-- Agora vamos recriar as tabelas do zero
CREATE TABLE purchase_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
    supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
    status text DEFAULT 'pending',
    total_amount decimal(10,2) NOT NULL DEFAULT 0,
    notes text,
    delivery_time text
);

CREATE TABLE purchase_order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
    part_description text NOT NULL,
    quantity integer NOT NULL,
    unit_price decimal(10,2) NOT NULL,
    total_price decimal(10,2) NOT NULL,
    notes text,
    quotation_request_id uuid REFERENCES quotation_requests(id) ON DELETE SET NULL
);

-- Configurar permissões
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

GRANT ALL ON purchase_orders TO authenticated;
GRANT ALL ON purchase_order_items TO authenticated;

CREATE POLICY "Enable all access for authenticated users" ON purchase_orders
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON purchase_order_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Forçar atualização do cache do schema
NOTIFY pgrst, 'reload schema';
