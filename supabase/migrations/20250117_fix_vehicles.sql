-- Drop existing tables if they exist
drop table if exists public.quotation_requests;
drop table if exists public.quotations;
drop table if exists public.vehicles;

-- Recreate vehicles table
create table public.vehicles (
    id uuid default uuid_generate_v4() primary key,
    brand text not null,
    model text not null,
    year text not null,
    plate text,
    chassis text,
    images text[] default array[]::text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.vehicles enable row level security;

-- Create policy
create policy "Enable all access for authenticated users" on public.vehicles
    for all
    to authenticated
    using (true)
    with check (true);

-- Create quotations table
create table public.quotations (
    id uuid default uuid_generate_v4() primary key,
    vehicle_id uuid references public.vehicles(id) not null,
    parts jsonb not null,
    description text,
    input_type text not null default 'manual',
    status text not null default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.quotations enable row level security;

-- Create policy
create policy "Enable all access for authenticated users" on public.quotations
    for all
    to authenticated
    using (true)
    with check (true);

-- Create triggers
create trigger handle_vehicles_updated_at
    before update on public.vehicles
    for each row
    execute function public.handle_updated_at();

create trigger handle_quotations_updated_at
    before update on public.quotations
    for each row
    execute function public.handle_updated_at();
