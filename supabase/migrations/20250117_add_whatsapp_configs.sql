-- Criar tabela whatsapp_configs
create table if not exists whatsapp_configs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  evolution_api_url text not null,
  evolution_api_key text not null,
  instance_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(company_id)
);

-- Trigger para updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger update_whatsapp_configs_updated_at
  before update on whatsapp_configs
  for each row
  execute function update_updated_at_column();

-- Políticas RLS
alter table whatsapp_configs enable row level security;

-- Política para select
create policy "Users can view whatsapp configs of their company"
  on whatsapp_configs
  for select
  using (
    company_id in (
      select company_id 
      from company_users 
      where user_id = auth.uid()
    )
  );

-- Política para insert
create policy "Users can insert whatsapp configs for their company"
  on whatsapp_configs
  for insert
  with check (
    company_id in (
      select company_id 
      from company_users 
      where user_id = auth.uid()
    )
  );

-- Política para update
create policy "Users can update whatsapp configs of their company"
  on whatsapp_configs
  for update
  using (
    company_id in (
      select company_id 
      from company_users 
      where user_id = auth.uid()
    )
  )
  with check (
    company_id in (
      select company_id 
      from company_users 
      where user_id = auth.uid()
    )
  );

-- Política para delete
create policy "Users can delete whatsapp configs of their company"
  on whatsapp_configs
  for delete
  using (
    company_id in (
      select company_id 
      from company_users 
      where user_id = auth.uid()
    )
  );
