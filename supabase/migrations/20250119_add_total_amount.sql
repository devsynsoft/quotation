-- Add total_amount to quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) DEFAULT 0;
