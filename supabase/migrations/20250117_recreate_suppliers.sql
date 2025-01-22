-- Drop existing table
drop table if exists public.suppliers cascade;

-- Recreate suppliers table
create table public.suppliers (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    area_code text not null,
    phone text not null,
    city text not null,
    state text not null,
    categories text[] default array[]::text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.suppliers enable row level security;

-- Create policy
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

-- Insert sample suppliers
insert into public.suppliers (name, area_code, phone, city, state, categories) values
    ('Auto Peças Silva', '11', '999999999', 'São Paulo', 'SP', array['genuine', 'parallel']),
    ('Peças & Cia', '11', '988888888', 'São Paulo', 'SP', array['parallel', 'used']),
    ('Genuínas Express', '11', '977777777', 'Guarulhos', 'SP', array['genuine']);
