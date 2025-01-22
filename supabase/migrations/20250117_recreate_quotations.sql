-- Drop existing table
drop table if exists public.quotation_requests cascade;
drop table if exists public.quotations cascade;

-- Recreate quotations table
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

-- Create trigger for updated_at
create trigger handle_quotations_updated_at
    before update on public.quotations
    for each row
    execute function public.handle_updated_at();

-- Recreate quotation_requests table
create table public.quotation_requests (
    id uuid default uuid_generate_v4() primary key,
    quotation_id uuid references public.quotations(id) not null,
    supplier_id uuid references public.suppliers(id) not null,
    status text not null default 'pending',
    response jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.quotation_requests enable row level security;

-- Create policy
create policy "Enable all access for authenticated users" on public.quotation_requests
    for all
    to authenticated
    using (true)
    with check (true);

-- Create trigger for updated_at
create trigger handle_quotation_requests_updated_at
    before update on public.quotation_requests
    for each row
    execute function public.handle_updated_at();
