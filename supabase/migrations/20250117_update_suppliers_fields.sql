-- Drop existing table
drop table if exists public.suppliers cascade;

-- Recreate suppliers table
create table public.suppliers (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    phone text not null,
    ddd text generated always as (
        case 
            when phone ~ '^\+?55?([0-9]{2})[0-9]+$' 
            then (regexp_matches(phone, '^\+?55?([0-9]{2})[0-9]+$'))[1]
            else null 
        end
    ) stored,
    city text not null,
    state text not null,
    part_types text[] default array[]::text[], -- genuina, paralela, usada
    specializations text[] default array[]::text[], -- motor, câmbio, suspensão, etc
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
insert into public.suppliers (name, phone, city, state, part_types, specializations) values
    ('Auto Peças Silva', '5511999999999', 'São Paulo', 'SP', 
     array['genuina', 'paralela'], 
     array['motor', 'câmbio']),
    ('Peças & Cia', '5511988888888', 'São Paulo', 'SP', 
     array['paralela', 'usada'], 
     array['suspensão', 'freios']),
    ('Genuínas Express', '5511977777777', 'Guarulhos', 'SP', 
     array['genuina'], 
     array['motor', 'elétrica']);
