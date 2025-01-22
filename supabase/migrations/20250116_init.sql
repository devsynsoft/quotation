-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql security definer;

-- Create vehicles table
create table if not exists public.vehicles (
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

-- Create policies
create policy "Enable all access for authenticated users" on public.vehicles
    for all
    to authenticated
    using (true)
    with check (true);

-- Create trigger for updated_at
create trigger handle_vehicles_updated_at
    before update on public.vehicles
    for each row
    execute function public.handle_updated_at();

-- Create quotations table
create table if not exists public.quotations (
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

-- Create policies
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

-- Create suppliers table
create table if not exists public.suppliers (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    phone text not null,
    city text not null,
    state text not null,
    categories text[] not null default array[]::text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.suppliers enable row level security;

-- Create policies
create policy "Enable all access for authenticated users" on public.suppliers
    for all
    to authenticated
    using (true)
    with check (true);

-- Create trigger for updated_at
create trigger handle_suppliers_updated_at
    before update on public.suppliers
    for each row
    execute function public.handle_updated_at();

-- Create quotation requests table
create table if not exists public.quotation_requests (
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

-- Create policies
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
