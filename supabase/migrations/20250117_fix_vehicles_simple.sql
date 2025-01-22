-- Drop existing tables
drop table if exists public.quotation_requests;
drop table if exists public.quotations;
drop table if exists public.vehicles;

-- Create vehicles table (simplified version)
create table public.vehicles (
    id uuid default uuid_generate_v4() primary key,
    brand text not null,
    model text not null,
    year text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.vehicles enable row level security;

-- Create policy
create policy "Enable all access for authenticated users" on public.vehicles
    for all
    to authenticated
    using (true)
    with check (true);
