// Utilitário central de fuso horário. TODO cálculo de "hoje", "este mês" ou
// "limites do dia" no app deve passar por aqui — nunca usar
// `new Date().toISOString()` direto pra isso, porque o servidor roda em UTC
// e São Paulo é UTC-3. Sem esse ajuste, tudo que acontece entre 21h e 23h59
// (horário de SP) é contado como se já fosse o dia/mês seguinte.
//
// Brasil não usa mais horário de verão desde 2019, então -03:00 é fixo o
// ano inteiro — não precisa de lógica de DST aqui.

const SP_OFFSET = '-03:00'
const pad = (n: number) => String(n).padStart(2, '0')

// "Hoje" em São Paulo, como 'YYYY-MM-DD' — não confundir com
// `new Date().toISOString().slice(0,10)`, que dá a data em UTC.
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Quantos dias tem o mês `m` (1-indexado) do ano `y`. Cálculo em UTC puro
// (Date.UTC), então não depende do fuso do servidor.
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// Início/fim de um dia específico de SP (00:00:00.000 e 23:59:59.999,
// horário de SP), devolvidos como instante UTC (ISO) — prontos pra usar
// direto num filtro .gte()/.lte() do Supabase.
export function dayBoundsSaoPaulo(dateStr: string): { start: string; end: string } {
  return {
    start: new Date(`${dateStr}T00:00:00.000${SP_OFFSET}`).toISOString(),
    end:   new Date(`${dateStr}T23:59:59.999${SP_OFFSET}`).toISOString(),
  }
}

// Início/fim de um mês inteiro de SP (dia 1 00:00 até o último dia 23:59:59.999,
// horário de SP), devolvidos como instante UTC (ISO).
export function monthBoundsSaoPaulo(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = daysInMonth(y, m)
  return {
    start: new Date(`${y}-${pad(m)}-01T00:00:00.000${SP_OFFSET}`).toISOString(),
    end:   new Date(`${y}-${pad(m)}-${pad(lastDay)}T23:59:59.999${SP_OFFSET}`).toISOString(),
  }
}

// Soma (ou subtrai, com número negativo) dias a uma data 'YYYY-MM-DD',
// devolvendo outra 'YYYY-MM-DD' — sempre em aritmética de calendário pura
// (UTC), então não escorrega de dia por causa do fuso.
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// Dia da semana (0=domingo...6=sábado) de um instante, em horário de SP —
// não usar `.getDay()` direto num Date, isso lê o fuso do servidor (UTC).
export function weekdayInSaoPaulo(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(d)
  const map: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }
  return map[wd] ?? 0
}

// Hora do dia (0-23) de um instante, em horário de SP.
export function hourInSaoPaulo(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', hour: '2-digit' }).format(d)
  return Number(h)
}
