-- Campanhas: closers que ficam DE FORA de uma campanha (ex.: a campanha "de casa" para quem não foi ao evento).
-- Lista de profile_id (jsonb). Nulo/vazio = o time todo participa (como sempre foi). Pode rodar mais de uma vez.
alter table public.campaigns add column if not exists exclude jsonb;
