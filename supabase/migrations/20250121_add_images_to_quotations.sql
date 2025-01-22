-- Adiciona coluna de imagens na tabela quotations
ALTER TABLE quotations
ADD COLUMN images text[] DEFAULT '{}';

-- Copia as imagens do veículo para a cotação
UPDATE quotations q
SET images = v.images
FROM vehicles v
WHERE q.vehicle_id = v.id
AND v.images IS NOT NULL
AND v.images != '{}';

-- Atualiza a função de inserção de cotação para incluir as imagens
CREATE OR REPLACE FUNCTION insert_quotation(
  p_user_id uuid,
  p_vehicle jsonb,
  p_parts jsonb[],
  p_images text[] DEFAULT '{}'::text[]
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_vehicle_id uuid;
  v_quotation_id uuid;
BEGIN
  -- Insere o veículo
  INSERT INTO vehicles (
    brand,
    model,
    year,
    chassis,
    user_id,
    images
  )
  VALUES (
    p_vehicle->>'brand',
    p_vehicle->>'model',
    p_vehicle->>'year',
    p_vehicle->>'chassis',
    p_user_id,
    p_images
  )
  RETURNING id INTO v_vehicle_id;

  -- Insere a cotação
  INSERT INTO quotations (
    user_id,
    vehicle_id,
    status,
    images
  )
  VALUES (
    p_user_id,
    v_vehicle_id,
    'draft',
    p_images
  )
  RETURNING id INTO v_quotation_id;

  -- Insere as peças
  INSERT INTO quotation_items (
    quotation_id,
    description,
    quantity,
    notes,
    operation,
    code,
    part_type,
    painting_hours
  )
  SELECT
    v_quotation_id,
    (part->>'description')::text,
    (part->>'quantity')::integer,
    (part->>'notes')::text,
    (part->>'operation')::text,
    (part->>'code')::text,
    (part->>'part_type')::text,
    (part->>'painting_hours')::numeric
  FROM unnest(p_parts) AS part;

  RETURN v_quotation_id;
END;
$$;
