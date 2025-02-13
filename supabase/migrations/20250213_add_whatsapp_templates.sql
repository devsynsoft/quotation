-- Create whatsapp_templates table
create table if not exists whatsapp_templates (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content text not null,
  "order" integer not null,
  user_id uuid references auth.users(id) on delete cascade not null
);

-- Enable RLS
alter table whatsapp_templates enable row level security;

-- Create policies
create policy "Users can view their own templates"
  on whatsapp_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert their own templates"
  on whatsapp_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own templates"
  on whatsapp_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own templates"
  on whatsapp_templates for delete
  using (auth.uid() = user_id);

-- Add default templates
insert into whatsapp_templates (content, "order", user_id)
values 
  ('Opa, aqui é o Felipe da Multiveicular de Florianopolis/SC, tudo  bem?

Será que você consegue me ajudar com estas peças do veículo abaixo:

*{vehicle_brand}* 
*{vehicle_model}* ANO *{vehicle_year}*
*{vehicle_chassis}*

*Peças que estou precisando:*', 1, '00000000-0000-0000-0000-000000000000'),
  ('{parts_list}', 2, '00000000-0000-0000-0000-000000000000'),
  ('Para agilizar o pagamento e faturamento das peças, favor informar a disponibilidade e valores somente através desse link: 
{quotation_link}', 3, '00000000-0000-0000-0000-000000000000');
