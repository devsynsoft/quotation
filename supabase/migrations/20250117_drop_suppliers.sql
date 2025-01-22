-- Drop existing table and policies
DROP TABLE IF EXISTS suppliers CASCADE;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
