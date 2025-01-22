-- Atualiza o template padrão
UPDATE message_templates
SET content = 'Olá! Temos uma nova cotação de peças para o veículo:
{vehicle_brand} {vehicle_model} {vehicle_year}
Chassi/Placa: {vehicle_chassis}

Peças necessárias:
{parts_list}

Para mais detalhes e enviar sua cotação, acesse:
{quotation_link}'
WHERE is_default = true;
