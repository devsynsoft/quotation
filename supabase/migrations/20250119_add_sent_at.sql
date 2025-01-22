-- Add sent_at to quotation_requests
ALTER TABLE quotation_requests 
ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;
