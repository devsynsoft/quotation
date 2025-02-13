-- Adiciona coluna para relacionar item da ordem de compra com a peça da cotação
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS quotation_part_index integer;

-- Adiciona índice para melhorar performance das queries
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_quotation_part 
ON purchase_order_items(purchase_order_id, quotation_part_index);
