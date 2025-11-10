-- Allow sharing a global message template across all users
alter table message_templates
  alter column user_id drop not null;

alter table message_templates
  add column if not exists is_global boolean not null default false;

-- Ensure existing rows have the default value
update message_templates
  set is_global = coalesce(is_global, false);

-- Reset policies so global templates can be read by everyone but
-- only owners can manage their personal templates
drop policy if exists "Users can view their own templates" on message_templates;
drop policy if exists "Users can insert their own templates" on message_templates;
drop policy if exists "Users can update their own templates" on message_templates;
drop policy if exists "Users can delete their own templates" on message_templates;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_templates'
      and policyname = 'Users can view templates'
  ) then
    create policy "Users can view templates"
      on message_templates for select
      using (is_global or user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_templates'
      and policyname = 'Users can insert templates'
  ) then
    create policy "Users can insert templates"
      on message_templates for insert
      with check (not is_global and user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_templates'
      and policyname = 'Users can update templates'
  ) then
    create policy "Users can update templates"
      on message_templates for update
      using (not is_global and user_id = auth.uid())
      with check (not is_global and user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_templates'
      and policyname = 'Users can delete templates'
  ) then
    create policy "Users can delete templates"
      on message_templates for delete
      using (not is_global and user_id = auth.uid());
  end if;
end$$;

-- Seed a default global template if it does not exist yet
insert into message_templates (user_id, name, content, is_default, sequence, is_global)
select
  null,
  'Template Global',
  '*Cotação de Peças*
Veículo: {vehicle_brand} {vehicle_model} {vehicle_year}
{vehicle_chassis}

*Peças necessárias:*
{parts_list}

Para enviar sua cotação, acesse: {quotation_link}',
  true,
  0,
  true
where not exists (
  select 1 from message_templates where is_global = true
);
