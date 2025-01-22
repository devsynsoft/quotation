-- Drop existing tables
drop table if exists public.pedidos_cotacao;
drop table if exists public.cotacoes;
drop table if exists public.veiculos;
drop table if exists public.fornecedores;

-- Create veiculos table
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

-- Create fornecedores table
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

-- Create cotacoes table
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

-- Create pedidos_cotacao table
create table public.pedidos_cotacao (
    id uuid default uuid_generate_v4() primary key,
    cotacao_id uuid references public.cotacoes(id) not null,
    fornecedor_id uuid references public.fornecedores(id) not null,
    status text not null default 'pendente',
    resposta jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.veiculos enable row level security;
alter table public.fornecedores enable row level security;
alter table public.cotacoes enable row level security;
alter table public.pedidos_cotacao enable row level security;

-- Create policies
create policy "Acesso total para usuários autenticados" on public.veiculos
    for all to authenticated using (true) with check (true);

create policy "Acesso total para usuários autenticados" on public.fornecedores
    for all to authenticated using (true) with check (true);

create policy "Acesso total para usuários autenticados" on public.cotacoes
    for all to authenticated using (true) with check (true);

create policy "Acesso total para usuários autenticados" on public.pedidos_cotacao
    for all to authenticated using (true) with check (true);
