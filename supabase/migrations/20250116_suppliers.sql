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
alter table public.suppliers enable row level security;
alter table public.quotation_requests enable row level security;

-- Create policies
create policy "Enable all access for authenticated users" on public.suppliers
    for all
    to authenticated
    using (true)
    with check (true);

create policy "Enable all access for authenticated users" on public.quotation_requests
    for all
    to authenticated
    using (true)
    with check (true);

-- Create updated_at trigger function if not exists
do $$
begin
    if not exists (select 1 from pg_proc where proname = 'handle_updated_at') then
        create function public.handle_updated_at()
        returns trigger as $$
        begin
            new.updated_at = timezone('utc'::text, now());
            return new;
        end;
        $$ language plpgsql security definer;
    end if;
end $$;

-- Create triggers
create trigger handle_suppliers_updated_at
    before update on public.suppliers
    for each row
    execute function public.handle_updated_at();

create trigger handle_quotation_requests_updated_at
    before update on public.quotation_requests
    for each row
    execute function public.handle_updated_at();
