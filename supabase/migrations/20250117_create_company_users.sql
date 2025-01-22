create table if not exists company_users (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('admin', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(company_id, user_id)
);

-- Criar uma empresa padrão
insert into companies (name, document) values ('Minha Empresa', '00000000000000')
on conflict do nothing;
