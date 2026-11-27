-- ════════════════════════════════════════════════════════════════════════
-- FORECAST · "Meta do Radar" (editável).
-- Rode UMA vez no SQL Editor do Supabase. Pode rodar de novo sem estragar nada.
-- Cria a tabela com a meta que o Radar, a rota e o hora a hora usam em cada mês
-- (a meta cadastrada em company_goals continua valendo nos outros painéis).
-- Já deixa novembro/2026 em R$ 13.600.000 (só se ainda não houver valor).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.forecast_radar_meta (
  month      text primary key,                         -- 'AAAA-MM'
  meta       numeric not null check (meta > 0 and meta <= 1000000000),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.forecast_radar_meta enable row level security;     -- sem policy: só o servidor (service role) lê e grava

insert into public.forecast_radar_meta (month, meta) values ('2026-11', 13600000) on conflict (month) do nothing;

-- ── Ajuste manual do plano do Radar (23/11 em R$ 159.217, o resto vai para 30/11) ──────────────────────
-- A coluna é criada e o ajuste de novembro/2026 é semeado SÓ na primeira vez (se você remover o ajuste depois, rodar de novo não o traz de volta).
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'forecast_radar_meta' and column_name = 'ajustes') then
    alter table public.forecast_radar_meta add column ajustes jsonb not null default '[]'::jsonb;
    update public.forecast_radar_meta set ajustes = '[{"dia":"2026-11-23","planejada":159217,"para":"2026-11-30"}]'::jsonb where month = '2026-11';
  end if;
end $$;
