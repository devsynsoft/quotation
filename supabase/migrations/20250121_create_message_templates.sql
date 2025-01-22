-- Create message_templates table
create table if not exists message_templates (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  content text not null,
  is_default boolean default false not null
);

-- Enable RLS
alter table message_templates enable row level security;

-- Create policies
create policy "Users can view their own templates"
  on message_templates for select
  using (user_id = auth.uid());

create policy "Users can insert their own templates"
  on message_templates for insert
  with check (user_id = auth.uid());

create policy "Users can update their own templates"
  on message_templates for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own templates"
  on message_templates for delete
  using (user_id = auth.uid());

-- Create trigger for updated_at
create trigger handle_message_templates_updated_at
  before update on message_templates
  for each row
  execute function handle_updated_at();

-- Insert default template
insert into message_templates (user_id, name, content, is_default) 
select 
  id as user_id,
  'Padrão' as name,
  '*Cotação de Peças*
Veículo: {vehicle_brand} {vehicle_model} {vehicle_year}
{vehicle_chassis}

*Peças necessárias:*
{parts_list}

Para enviar sua cotação, acesse: {quotation_link}' as content,
  true as is_default
from auth.users;
