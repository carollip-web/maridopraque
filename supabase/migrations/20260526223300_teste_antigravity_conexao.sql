-- Migration de teste: tabela de validação de conexão Antigravity
CREATE TABLE IF NOT EXISTS public.teste_antigravity_conexao (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);
