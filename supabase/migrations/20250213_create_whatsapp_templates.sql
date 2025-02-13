-- Create whatsapp_templates table
create table if not exists whatsapp_templates (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content text not null,
  "order" integer not null
);

-- Enable RLS
alter table whatsapp_templates enable row level security;

-- Create policies para permitir acesso a todos os usuários autenticados
create policy "Authenticated users can view templates"
  on whatsapp_templates for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert templates"
  on whatsapp_templates for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update templates"
  on whatsapp_templates for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete templates"
  on whatsapp_templates for delete
  using (auth.role() = 'authenticated');

-- Insere os templates padrão
insert into whatsapp_templates (content, "order")
values 
  ('Opa, aqui é o Felipe da Multiveicular de Florianopolis/SC, tudo  bem?

Será que você consegue me ajudar com estas peças do veículo abaixo:

*{vehicle_brand}* 
*{vehicle_model}* ANO *{vehicle_year}*
*{vehicle_chassis}*

*Peças que estou precisando:*', 1),
  ('{parts_list}', 2),
  ('Para agilizar o pagamento e faturamento das peças, favor informar a disponibilidade e valores somente através desse link: 
{quotation_link}', 3);
