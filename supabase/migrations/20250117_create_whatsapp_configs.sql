create table if not exists whatsapp_configs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null unique,
  evolution_api_url text not null,
  evolution_api_key text not null,
  instance_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
