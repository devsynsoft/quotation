-- Habilita a extensão uuid-ossp se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilita a extensão pgcrypto se ainda não estiver habilitada (para gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
