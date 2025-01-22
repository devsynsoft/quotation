-- Add sent_at column to quotation_requests
ALTER TABLE quotation_requests 
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update status type to include 'failed'
ALTER TABLE quotation_requests 
DROP CONSTRAINT IF EXISTS quotation_requests_status_check;

ALTER TABLE quotation_requests 
ADD CONSTRAINT quotation_requests_status_check 
CHECK (status IN ('pending', 'sent', 'failed', 'answered'));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
