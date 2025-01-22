-- Create vehicles table
create table if not exists public.vehicles (
    id uuid default uuid_generate_v4() primary key,
    brand text not null,
    model text not null,
    year text not null,
    plate text,
    chassis text,
    images text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create quotations table
create table if not exists public.quotations (
    id uuid default uuid_generate_v4() primary key,
    vehicle_id uuid references public.vehicles(id) not null,
    parts jsonb not null,
    description text,
    input_type text not null default 'manual', -- 'manual', 'bulk', 'report'
    status text not null default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.vehicles enable row level security;
alter table public.quotations enable row level security;

-- Create storage bucket for vehicle images
insert into storage.buckets (id, name, public) 
values ('vehicle-images', 'vehicle-images', true);

-- Create policies
create policy "Enable all access for authenticated users" on public.vehicles
    for all
    to authenticated
    using (true)
    with check (true);

create policy "Enable all access for authenticated users" on public.quotations
    for all
    to authenticated
    using (true)
    with check (true);

-- Storage policies
create policy "Give users access to own folder" on storage.objects
    for all
    to authenticated
    using (bucket_id = 'vehicle-images');

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql security definer;

-- Create triggers
create trigger handle_vehicles_updated_at
    before update on public.vehicles
    for each row
    execute function public.handle_updated_at();

create trigger handle_quotations_updated_at
    before update on public.quotations
    for each row
    execute function public.handle_updated_at();
