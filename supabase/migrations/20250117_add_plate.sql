-- Add plate column to vehicles table
alter table public.vehicles 
add column if not exists plate text;
