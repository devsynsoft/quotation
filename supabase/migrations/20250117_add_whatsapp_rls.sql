-- Reset políticas existentes
drop policy if exists "Users can view whatsapp configs of their company" on whatsapp_configs;
drop policy if exists "Users can insert whatsapp configs for their company" on whatsapp_configs;
drop policy if exists "Users can update whatsapp configs of their company" on whatsapp_configs;
drop policy if exists "Users can delete whatsapp configs of their company" on whatsapp_configs;

-- Habilitar RLS
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
