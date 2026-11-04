import type { KunjunganRumahRecord } from './types'

export interface MonthlyKunjunganRumahStat {
  month: string
  label: string
  totalKunjungan: number
  byPosyandu: Array<{ nama: string; count: number }>
}

export type KunjunganRumahDashboardKategori =
  'all' | 'balita' | 'ibu-hamil' | 'lansia'

export type KunjunganRumahDashboardStatus = 'all' | 'sehat' | 'berisiko'

export interface KunjunganRumahDashboardPageInput {
  month: string
  page: number
  search: string
  category: KunjunganRumahDashboardKategori
  status: KunjunganRumahDashboardStatus
}

export interface KunjunganRumahDashboardPage {
  records: KunjunganRumahRecord[]
  total: number
  page: number
  pageSize: number
  summary: {
    total: number
    flagged: number
    followedUp: number
  }
}
