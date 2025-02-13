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
