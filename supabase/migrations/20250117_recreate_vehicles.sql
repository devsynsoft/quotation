-- Drop existing table
drop table if exists public.vehicles cascade;

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

-- Create trigger for updated_at
create trigger handle_vehicles_updated_at
    before update on public.vehicles
    for each row
    execute function public.handle_updated_at();
