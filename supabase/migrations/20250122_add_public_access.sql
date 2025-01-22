-- Adiciona políticas para permitir acesso público às cotações e solicitações
drop policy if exists "Permitir acesso público a cotações via link" on quotations;
drop policy if exists "Permitir acesso público a solicitações via link" on quotation_requests;
drop policy if exists "Permitir acesso público a veículos via link" on vehicles;

-- Políticas para quotations
create policy "Permitir acesso público a cotações via link"
  on quotations for select
  using (true);  -- Permite leitura pública

-- Políticas para quotation_requests
create policy "Permitir acesso público a solicitações via link"
  on quotation_requests for select
  using (true);  -- Permite leitura pública

create policy "Permitir atualização pública de solicitações via link"
  on quotation_requests for update
  using (true)  -- Permite atualização pública
  with check (status = 'responded');  -- Mas apenas para marcar como respondida

-- Políticas para vehicles
create policy "Permitir acesso público a veículos via link"
  on vehicles for select
  using (true);  -- Permite leitura pública
