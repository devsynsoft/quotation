-- Remover RLS
alter table companies disable row level security;
alter table company_users disable row level security;

-- Remover todas as políticas existentes
drop policy if exists "Permitir acesso total para usuários autenticados" on companies;
drop policy if exists "Permitir select para usuários autenticados" on company_users;
drop policy if exists "Permitir insert para usuários autenticados" on company_users;
drop policy if exists "Permitir update/delete para admins" on company_users;
