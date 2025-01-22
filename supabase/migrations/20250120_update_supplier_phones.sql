-- Atualiza os números dos fornecedores para incluir o DDD
UPDATE public.suppliers
SET ddd = '49'
WHERE phone = '991320199' OR phone = '999890922';

-- Atualiza os números dos fornecedores para remover o DDD do campo phone
UPDATE public.suppliers
SET phone = SUBSTRING(phone FROM 3)
WHERE LENGTH(phone) = 11;
