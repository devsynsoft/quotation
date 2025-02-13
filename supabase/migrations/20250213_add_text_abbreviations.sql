-- Cria tabela para armazenar abreviações de texto
create table text_abbreviations (
  id uuid default gen_random_uuid() primary key,
  abbreviation text not null,
  full_text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id) not null,
  
  -- Garante que não haverá abreviações duplicadas
  constraint unique_abbreviation unique (abbreviation)
);

-- Adiciona algumas abreviações comuns como exemplo
insert into text_abbreviations (abbreviation, full_text, created_by)
values 
  ('RETROV', 'RETROVISOR', 'ba524f10-c9f2-47e2-b4f9-37e9148f53cf'),
  ('DIANT', 'DIANTEIRO', 'ba524f10-c9f2-47e2-b4f9-37e9148f53cf'),
  ('TRAS', 'TRASEIRO', 'ba524f10-c9f2-47e2-b4f9-37e9148f53cf'),
  ('ESQ', 'ESQUERDO', 'ba524f10-c9f2-47e2-b4f9-37e9148f53cf'),
  ('DIR', 'DIREITO', 'ba524f10-c9f2-47e2-b4f9-37e9148f53cf');

-- Função para atualizar updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger para atualizar updated_at
create trigger update_text_abbreviations_updated_at
  before update on text_abbreviations
  for each row
  execute function update_updated_at_column();

-- Policies para controle de acesso
create policy "Usuários autenticados podem ler abreviações"
  on text_abbreviations for select
  to authenticated
  using (true);

create policy "Usuários autenticados podem inserir abreviações"
  on text_abbreviations for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Usuários podem editar suas próprias abreviações"
  on text_abbreviations for update
  to authenticated
  using (auth.uid() = created_by);

create policy "Usuários podem deletar suas próprias abreviações"
  on text_abbreviations for delete
  to authenticated
  using (auth.uid() = created_by);

-- Habilita RLS
alter table text_abbreviations enable row level security;
