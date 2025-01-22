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

-- Create updated_at trigger
create trigger handle_quotations_updated_at
    before update on public.quotations
    for each row
    execute function public.handle_updated_at();
