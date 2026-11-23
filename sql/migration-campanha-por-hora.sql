-- ════════════════════════════════════════════════════════════════════════
-- CAMPANHAS · critério "POR HORA".
-- Rode UMA vez no SQL Editor do Supabase. Pode rodar de novo sem estragar nada.
-- 1) cria a coluna `hourly` (jsonb) com o horário da campanha (dia completo ou intervalos, em minutos do relógio de São Paulo);
-- 2) libera o valor 'hourly' na trava de critérios (campaigns_criterion_check).
-- Nada muda para as campanhas que já existem.
-- ════════════════════════════════════════════════════════════════════════
alter table public.campaigns add column if not exists hourly jsonb;

alter table public.campaigns drop constraint if exists campaigns_criterion_check;
alter table public.campaigns add constraint campaigns_criterion_check
  check (criterion = any (array['best_day','best_sale','count_rank','first_count','first_revenue','revenue_rank','tier_revenue','hourly']::text[]));
