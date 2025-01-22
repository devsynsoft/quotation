-- Adiciona coluna para o token de resposta
ALTER TABLE quotation_requests
ADD COLUMN response_token uuid DEFAULT gen_random_uuid();

-- Garante que o token seja único
ALTER TABLE quotation_requests
ADD CONSTRAINT quotation_requests_response_token_key UNIQUE (response_token);

-- Cria índice para busca rápida por token
CREATE INDEX idx_quotation_requests_response_token ON quotation_requests(response_token);

-- Atualiza os tokens existentes
UPDATE quotation_requests
SET response_token = gen_random_uuid()
WHERE response_token IS NULL;
