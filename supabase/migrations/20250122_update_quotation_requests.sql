-- Adiciona colunas para armazenar a resposta
ALTER TABLE quotation_requests
ADD COLUMN response_data jsonb,
ADD COLUMN responded_at timestamp with time zone;
