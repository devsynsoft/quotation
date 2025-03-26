-- Função para verificar se um fornecedor tem cotações
create or replace function public.check_supplier_quotations(supplier_id uuid)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select jsonb_build_object(
    'id', qr.id,
    'quotation_id', qr.quotation_id
  )
  from quotation_requests qr
  where qr.supplier_id = check_supplier_quotations.supplier_id;
end;
$$;
