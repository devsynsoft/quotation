-- Remover políticas existentes
drop policy if exists "Usuários podem ver empresas que pertencem" on companies;
drop policy if exists "Usuários podem criar empresas se não tiverem uma" on companies;
drop policy if exists "Admins podem atualizar suas empresas" on companies;
drop policy if exists "Admins podem ver usuários da empresa" on company_users;
drop policy if exists "Usuários podem criar relação ao criar empresa" on company_users;
drop policy if exists "Admins podem gerenciar usuários da empresa" on company_users;

-- Habilitar RLS
alter table companies enable row level security;
alter table company_users enable row level security;

-- Políticas para companies
create policy "Permitir acesso total para usuários autenticados"
  on companies for all
  using (auth.role() = 'authenticated');

-- Políticas para company_users
create policy "Permitir select para usuários autenticados"
  on company_users for select
  using (auth.role() = 'authenticated');

create policy "Permitir insert para usuários autenticados"
  on company_users for insert
  with check (
    auth.uid() = user_id
    and role = 'admin'
  );

create policy "Permitir update/delete para admins"
  on company_users for all
  using (
    auth.uid() = user_id
    and role = 'admin'
  );
