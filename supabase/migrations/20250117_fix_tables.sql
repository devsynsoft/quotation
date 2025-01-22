-- Criar função para updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql security definer;

-- Remover tabelas existentes
drop table if exists public.pedidos_cotacao;
drop table if exists public.cotacoes;
drop table if exists public.veiculos;
drop table if exists public.fornecedores;

-- Criar tabela veiculos
create table public.veiculos (
    id uuid default uuid_generate_v4() primary key,
    marca text not null,
    modelo text not null,
    ano text not null,
    placa text,
    chassi text,
    imagens text[] default array[]::text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Criar tabela fornecedores
create table public.fornecedores (
    id uuid default uuid_generate_v4() primary key,
    nome text not null,
    telefone text not null,
    cidade text not null,
    estado text not null,
    categorias text[] default array[]::text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Criar tabela cotacoes
create table public.cotacoes (
    id uuid default uuid_generate_v4() primary key,
    veiculo_id uuid references public.veiculos(id) not null,
    pecas jsonb not null,
    descricao text,
    tipo_entrada text not null default 'manual',
    status text not null default 'pendente',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Criar tabela pedidos_cotacao
create table public.pedidos_cotacao (
    id uuid default uuid_generate_v4() primary key,
    cotacao_id uuid references public.cotacoes(id) not null,
    fornecedor_id uuid references public.fornecedores(id) not null,
    status text not null default 'pendente',
    resposta jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.veiculos enable row level security;
alter table public.fornecedores enable row level security;
alter table public.cotacoes enable row level security;
alter table public.pedidos_cotacao enable row level security;

-- Criar políticas
create policy "Acesso total para usuários autenticados" on public.veiculos
    for all to authenticated using (true) with check (true);

create policy "Acesso total para usuários autenticados" on public.fornecedores
    for all to authenticated using (true) with check (true);

create policy "Acesso total para usuários autenticados" on public.cotacoes
    for all to authenticated using (true) with check (true);

create policy "Acesso total para usuários autenticados" on public.pedidos_cotacao
    for all to authenticated using (true) with check (true);

-- Criar triggers para updated_at
create trigger handle_veiculos_updated_at
    before update on public.veiculos
    for each row
    execute function public.handle_updated_at();

create trigger handle_fornecedores_updated_at
    before update on public.fornecedores
    for each row
    execute function public.handle_updated_at();

create trigger handle_cotacoes_updated_at
    before update on public.cotacoes
    for each row
    execute function public.handle_updated_at();

create trigger handle_pedidos_cotacao_updated_at
    before update on public.pedidos_cotacao
    for each row
    execute function public.handle_updated_at();

-- Inserir alguns fornecedores de exemplo
insert into public.fornecedores (nome, telefone, cidade, estado, categorias) values
    ('Auto Peças Silva', '11999999999', 'São Paulo', 'SP', array['genuina', 'paralela']),
    ('Peças & Cia', '11988888888', 'São Paulo', 'SP', array['paralela', 'usada']),
    ('Genuínas Express', '11977777777', 'Guarulhos', 'SP', array['genuina']);
