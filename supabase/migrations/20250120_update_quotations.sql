-- Add supplier_id to quotations
ALTER TABLE public.quotations
ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id);

-- Add total_amount to quotations if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 
                   FROM information_schema.columns 
                   WHERE table_schema = 'public'
                     AND table_name = 'quotations'
                     AND column_name = 'total_amount') THEN
        ALTER TABLE public.quotations
        ADD COLUMN total_amount decimal(10,2);
    END IF;
END $$;
