-- Adiciona coluna sequence
alter table message_templates 
add column sequence integer;

-- Atualiza os templates existentes com uma sequência inicial baseada no created_at
with ordered_templates as (
  select id, row_number() over (order by created_at) as seq
  from message_templates
)
update message_templates
set sequence = ordered_templates.seq
from ordered_templates
where message_templates.id = ordered_templates.id;

-- Torna a coluna sequence not null após ter valores iniciais
alter table message_templates 
alter column sequence set not null;

-- Cria as funções para atualizar sequências
create or replace function update_template_sequences_down(
  p_template_id uuid,
  p_old_sequence integer,
  p_new_sequence integer
) returns void as $$
begin
  -- Decrementa a sequência dos templates entre a posição antiga e nova
  update message_templates
  set sequence = sequence - 1
  where sequence > p_old_sequence 
    and sequence <= p_new_sequence
    and id != p_template_id;
end;
$$ language plpgsql security definer;

-- Função para atualizar sequências quando move um template para cima
create or replace function update_template_sequences_up(
  p_template_id uuid,
  p_old_sequence integer,
  p_new_sequence integer
) returns void as $$
begin
  -- Incrementa a sequência dos templates entre a posição nova e antiga
  update message_templates
  set sequence = sequence + 1
  where sequence >= p_new_sequence 
    and sequence < p_old_sequence
    and id != p_template_id;
end;
$$ language plpgsql security definer;

-- Adiciona políticas para permitir que usuários autenticados chamem as funções
grant execute on function update_template_sequences_down to authenticated;
grant execute on function update_template_sequences_up to authenticated;
