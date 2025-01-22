-- Create quotation_responses table
create table if not exists quotation_responses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  quotation_id uuid references quotations(id) on delete cascade not null,
  supplier_name text not null,
  supplier_phone text not null,
  parts jsonb not null,
  total_price numeric(10,2) not null,
  delivery_time text,
  notes text,
  status text default 'pending' not null
);

-- Add RLS policies
alter table quotation_responses enable row level security;

create policy "Public can insert quotation responses"
  on quotation_responses for insert
  with check (true);

create policy "Users can view responses for their quotations"
  on quotation_responses for select
  using (
    quotation_id in (
      select id from quotations
      where user_id = auth.uid()
    )
  );
