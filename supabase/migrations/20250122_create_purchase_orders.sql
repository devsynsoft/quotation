-- Cria a tabela de ordens de compra se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') THEN
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
    END IF;
END
$$;

-- Cria a tabela de itens da ordem de compra se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_order_items') THEN
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
    END IF;
END
$$;

-- Atualiza os privilégios para o service_role
GRANT ALL ON purchase_orders TO authenticated;
GRANT ALL ON purchase_order_items TO authenticated;

-- Atualiza o cache do schema
NOTIFY pgrst, 'reload schema';
