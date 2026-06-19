export interface PriceRow {
  vertical:      string
  produto:       string
  tempoAcesso:   string
  tipoAluno:     string
  canalVenda:    string
  precoCheio:    number
  precoEspecial: number
}

export type PaymentMode = 'parcelado' | 'avista' | '3x' | 'manual' | 'evento'

export interface AppSettings {
  spreadsheetUrl:      string
  columnMap:           Record<string, number>
  cashDiscountPercent: number
  defaultMonthlyRate:  number
  verticalRates:       Record<string, number>   // taxa por vertical (0 = sem juros)
  eventDiscounts:      Record<string, number>
}

export const DEFAULT_SETTINGS: AppSettings = {
  spreadsheetUrl: '',
  columnMap: {
    vertical:      0,
    produto:       1,
    tempoAcesso:   2,
    tipoAluno:     3,
    canalVenda:    4,
    precoCheio:    5,
    precoEspecial: 6,
  },
  cashDiscountPercent: 5,
  defaultMonthlyRate:  2.49,
  verticalRates: {
    'Med-Review R1': 0,      // 12x sem juros
    'Anest-Review':  2.49,
    'Oft-Review':    2.49,
    'Ortop-Review':  2.49,
  },
  eventDiscounts: {
    'Med-Review R1': 0,
    'Anest-Review':  0,
    'Oft-Review':    0,
    'Ortop-Review':  0,
  },
}
