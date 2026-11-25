-- Campanha de EVENTO: só os closers escolhidos concorrem e recebem aviso.
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo sem problema).
-- Guarda { "name": "Nome do evento", "closers": ["<id do perfil>", ...] }. Vazio (null) = campanha normal, do time inteiro.
alter table public.campaigns add column if not exists event jsonb;
