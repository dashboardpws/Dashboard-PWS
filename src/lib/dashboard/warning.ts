import { WARNING_CONFIG } from './warning.config'
import type { WarningConfig } from './warning.config'

/* ───────────── Domain model ───────────── */

export type WarningSeverity = 'critical' | 'attention' | 'reminder' | 'info'
export type WarningStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed'
export type WarningType =
  | 'sasaran_belum_dikunjungi'
  | 'jadwal_terlambat'
  | 'periode_mendekati_akhir'
  | 'cakupan_wilayah_rendah'
  | 'tindak_lanjut_belum_selesai'

export interface Warning {
  id: string
  type: WarningType
  severity: WarningSeverity
  title: string
  description: string
  period: { startDate: string; endDate: string }
  region: string | null
  status: WarningStatus
  source: string
  sourceId: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface MonitoringPeriod {
  startDate: string
  endDate: string
  daysRemaining: number
  status: 'active' | 'upcoming' | 'ended'
  progress: number
}

export const SEVERITY_ORDER: Record<WarningSeverity, number> = {
  critical: 0,
  attention: 1,
  reminder: 2,
  info: 3,
}

/* ───────────── Input (adapter dari data yang sudah ada) ───────────── */

/** Struktur sama dengan KelurahanStat → `data.kelurahan` bisa langsung dipakai. */
export interface CoverageRegion {
  name: string
  total: number
  dikunjungi: number
}

export interface JadwalItem {
  id: string
  nik: string | null
  nama: string
  kelurahan: string
  /** YYYY-MM-DD */
  tanggal: string
  status: 'terjadwal' | 'selesai' | 'batal'
}

export interface TindakLanjutItem {
  id: string
  nik: string
  nama: string
  kelurahan: string
  /** YYYY-MM-DD, tanggal kunjungan yang memunculkan kebutuhan tindak lanjut */
  tanggal: string
  status: 'belum' | 'proses' | 'selesai'
}

/** Bentuk minimal record Kunjungan Rumah. Mapping dari record asli dilakukan di
 *  pemanggil, jadi form / SASARAN_KEYS / record_legacy tidak disentuh. */
export interface KunjunganRecordLike {
  id: string
  nik: string | null
  nama: string
  kelurahan: string
  tanggal: string
  hasil: string | null
  /** Stempel server untuk memutuskan dua kunjungan pada tanggal yang sama. */
  waktuSimpan?: string
}

export interface WarningInput {
  regions: CoverageRegion[]
  jadwal?: JadwalItem[]
  tindakLanjut?: TindakLanjutItem[]
}

export interface BuildOptions {
  now?: Date
  /** Default: periode di config. Memfilter jadwal & tindak lanjut ke rentang ini. */
  period?: { startDate: string; endDate: string }
  /** Batasi semua perhitungan ke satu wilayah (kelurahan). */
  region?: string
  config?: WarningConfig
}

/* ───────────── Date helpers (lokal, bukan UTC) ───────────── */

function parseLocalDate(iso: string): Date {
  const [yStr, mStr, dStr] = iso.slice(0, 10).split('-')
  return new Date(Number(yStr), Number(mStr) - 1, Number(dStr))
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
/** Selisih hari kalender a − b (aman terhadap DST karena dibulatkan). */
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}
const fmtInt = (n: number) => n.toLocaleString('id-ID')
const fmtPct = (n: number) =>
  n.toLocaleString('id-ID', { maximumFractionDigits: 1 })

/* ───────────── Periode ───────────── */

export function computePeriod(
  startDate = WARNING_CONFIG.period.startDate,
  endDate = WARNING_CONFIG.period.endDate,
  now = new Date(),
): MonitoringPeriod {
  const s = parseLocalDate(startDate)
  const e = parseLocalDate(endDate)
  // Akhir periode inklusif: 31 Des masih "active" sampai 23:59:59
  const endExclusive = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1)
  const today = startOfDay(now)

  const status: MonitoringPeriod['status'] =
    today < s ? 'upcoming' : today >= endExclusive ? 'ended' : 'active'

  const total = endExclusive.getTime() - s.getTime()
  const elapsed = Math.min(Math.max(now.getTime() - s.getTime(), 0), total)

  return {
    startDate,
    endDate,
    // hari ini dihitung sebagai hari yang masih tersisa
    daysRemaining: status === 'ended' ? 0 : diffDays(endExclusive, today),
    status,
    progress: total > 0 ? elapsed / total : 0,
  }
}

/* ───────────── Turunan tindak lanjut dari field yang sudah ada ───────────── */

/** Tanpa waktuSimpan pada dua record lama, urutan input tetap menjadi fallback. */
export function kunjunganLebihBaru(
  kandidat: Pick<KunjunganRecordLike, 'tanggal' | 'waktuSimpan'>,
  pembanding: Pick<KunjunganRecordLike, 'tanggal' | 'waktuSimpan'>,
): boolean {
  if (kandidat.tanggal !== pembanding.tanggal)
    return kandidat.tanggal > pembanding.tanggal
  return (kandidat.waktuSimpan ?? '') > (pembanding.waktuSimpan ?? '')
}

/**
 * Per NIK, ambil kunjungan TERBARU. Jika hasilnya ada di `openHasil`, tindak lanjut
 * masih terbuka; jika kunjungan terbaru "Selesai", otomatis tertutup (tidak diemit).
 * "proses" belum bisa diturunkan tanpa field baru, jadi selalu "belum".
 */
export function deriveTindakLanjut(
  records: KunjunganRecordLike[],
  cfg: WarningConfig = WARNING_CONFIG,
): TindakLanjutItem[] {
  const latest = new Map<string, KunjunganRecordLike>()
  for (const r of records) {
    if (!r.nik) continue
    const cur = latest.get(r.nik)
    if (!cur || kunjunganLebihBaru(r, cur)) latest.set(r.nik, r)
  }
  const open = cfg.tindakLanjut.openHasil
  return [...latest.values()]
    .filter((r) => r.hasil !== null && open.includes(r.hasil))
    .map((r) => ({
      id: r.id,
      nik: r.nik as string,
      nama: r.nama,
      kelurahan: r.kelurahan,
      tanggal: r.tanggal,
      status: 'belum' as const,
    }))
}

/* ───────────── Builder ───────────── */

export function sortWarnings(list: Warning[]): Warning[] {
  // Array.prototype.sort stabil → urutan dalam severity yang sama dipertahankan
  return [...list].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )
}

export function buildWarnings(
  input: WarningInput,
  opts: BuildOptions = {},
): Warning[] {
  const cfg = opts.config ?? WARNING_CONFIG
  const now = opts.now ?? new Date()
  const period = computePeriod(
    opts.period?.startDate ?? cfg.period.startDate,
    opts.period?.endDate ?? cfg.period.endDate,
    now,
  )
  if (period.status === 'upcoming') return []

  const region = opts.region ?? null
  const periodRef = { startDate: period.startDate, endDate: period.endDate }
  const createdAt = now.toISOString()
  const today = startOfDay(now)
  const todayISO = toISODate(now)
  const suffix = region ? `:${region}` : ''

  const inRegion = (name: string) => region === null || name === region
  const inPeriod = (iso: string) => {
    const d = iso.slice(0, 10)
    return d >= period.startDate && d <= period.endDate
  }
  const mk = (
    w: Omit<Warning, 'period' | 'status' | 'createdAt' | 'resolvedAt'>,
  ): Warning => ({
    ...w,
    period: periodRef,
    status: 'active',
    createdAt,
    resolvedAt: null,
  })

  const out: Warning[] = []
  const regions = input.regions.filter((r) => inRegion(r.name))
  const total = regions.reduce((a, r) => a + r.total, 0)
  const visited = regions.reduce(
    (a, r) => a + Math.min(r.dikunjungi, r.total),
    0,
  )
  const belum = Math.max(0, total - visited)

  // 1. Sasaran belum dikunjungi
  if (belum > 0) {
    out.push(
      mk({
        id: `sasaran-belum${suffix}`,
        type: 'sasaran_belum_dikunjungi',
        severity: cfg.sasaranBelum.severity,
        title: `${fmtInt(belum)} sasaran belum dikunjungi`,
        description: `Cakupan ${fmtPct((visited / total) * 100)}% (${fmtInt(visited)} dari ${fmtInt(total)} sasaran)`,
        region,
        source: 'warga',
        sourceId: null,
      }),
    )
  }

  // 2. Jadwal terlambat: terjadwal, tanggal < hari ini, belum selesai
  const late = (input.jadwal ?? []).filter(
    (j) =>
      j.status === 'terjadwal' &&
      j.tanggal.slice(0, 10) < todayISO &&
      inRegion(j.kelurahan) &&
      inPeriod(j.tanggal),
  )
  if (late.length > 0) {
    out.push(
      mk({
        id: `jadwal-terlambat${suffix}`,
        type: 'jadwal_terlambat',
        severity: cfg.jadwalTerlambat.severity,
        title: `${fmtInt(late.length)} jadwal kunjungan terlambat`,
        description: '',
        region,
        source: 'jadwal',
        sourceId: late.length === 1 ? late[0]!.id : null,
      }),
    )
  }

  // 3. Periode mendekati akhir: hanya jika masih ada sasaran yang belum selesai
  if (belum > 0 && period.status === 'active') {
    const m = [...cfg.endOfPeriodMilestones]
      .sort((a, b) => a.days - b.days)
      .find((x) => period.daysRemaining <= x.days)
    if (m) {
      out.push(
        mk({
          // id memuat milestone → dismiss/acknowledge milestone 30 hari tidak
          // membungkam milestone 14 hari berikutnya
          id: `periode-akhir:${m.days}${suffix}`,
          type: 'periode_mendekati_akhir',
          severity: m.severity,
          title: `Periode berakhir ${period.daysRemaining} hari lagi. Masih ada ${fmtInt(belum)} sasaran yang belum dikunjungi.`,
          description: '',
          region,
          source: 'periode',
          sourceId: null,
        }),
      )
    }
  }

  // 4. Cakupan wilayah rendah: relatif terhadap jumlah sasaran wilayah (persentase)
  const lowCoverage = regions
    .filter((r) => r.total >= cfg.coverage.minSasaran)
    .map((r) => ({
      r,
      pct: Math.round((Math.min(r.dikunjungi, r.total) / r.total) * 100),
    }))
    .filter((x) => x.pct < cfg.coverage.lowPct)
    .sort((a, b) => a.pct - b.pct) // terendah dulu
  for (const { r, pct } of lowCoverage) {
    out.push(
      mk({
        id: `cakupan:${r.name}`,
        type: 'cakupan_wilayah_rendah',
        severity: pct < cfg.coverage.criticalPct ? 'critical' : 'attention',
        title: `Cakupan ${r.name} baru ${pct}%`,
        description: `${fmtInt(r.dikunjungi)} dari ${fmtInt(r.total)} sasaran dikunjungi`,
        region: r.name,
        source: 'kelurahan',
        sourceId: r.name,
      }),
    )
  }

  // 5. Tindak lanjut belum selesai (+ umur)
  const open = (input.tindakLanjut ?? []).filter(
    (t) =>
      t.status !== 'selesai' && inRegion(t.kelurahan) && inPeriod(t.tanggal),
  )
  if (open.length > 0) {
    const bands = [...cfg.tindakLanjut.ageBands].sort(
      (a, b) => b.overDays - a.overDays,
    )
    const perBand = new Map<number, number>()
    let worst = cfg.tindakLanjut.defaultSeverity
    for (const t of open) {
      const age = diffDays(today, parseLocalDate(t.tanggal))
      const band = bands.find((b) => age > b.overDays)
      if (!band) continue
      perBand.set(band.overDays, (perBand.get(band.overDays) ?? 0) + 1)
      if (SEVERITY_ORDER[band.severity] < SEVERITY_ORDER[worst])
        worst = band.severity
    }
    const nBelum = open.filter((t) => t.status === 'belum').length
    const nProses = open.length - nBelum
    const ageText = bands
      .filter((b) => perBand.has(b.overDays))
      .map((b) => `${perBand.get(b.overDays)} > ${b.overDays} hari`)
      .join(' · ')
    out.push(
      mk({
        id: `tindak-lanjut${suffix}`,
        type: 'tindak_lanjut_belum_selesai',
        severity: worst,
        title: `${fmtInt(open.length)} tindak lanjut belum selesai`,
        description: [
          `${nBelum} belum ditindaklanjuti`,
          `${nProses} sedang ditindaklanjuti`,
          ageText,
        ]
          .filter(Boolean)
          .join(' · '),
        region,
        source: 'tindak_lanjut',
        sourceId: open.length === 1 ? open[0]!.id : null,
      }),
    )
  }

  return sortWarnings(out)
}

/* ───────────── Status overlay (acknowledged / dismissed / resolved) ───────────── */

export type WarningStateMap = Record<
  string,
  { status: WarningStatus; at: string }
>

/** Tumpuk status tersimpan ke hasil builder. Persistensinya (DB / localStorage)
 *  belum dibuat; id deterministik memungkinkan ini ditambah tanpa mengubah builder. */
export function applyWarningStates(
  list: Warning[],
  states: WarningStateMap,
): Warning[] {
  return list.map((w) => {
    const s = states[w.id]
    if (!s) return w
    return {
      ...w,
      status: s.status,
      resolvedAt: s.status === 'resolved' ? s.at : w.resolvedAt,
    }
  })
}

/* ───────────── Seleksi untuk dashboard ───────────── */

export function selectTopWarnings(list: Warning[], limit: number) {
  const all = sortWarnings(list.filter((w) => w.status === 'active'))
  return {
    visible: all.slice(0, limit),
    all,
    hidden: Math.max(0, all.length - limit),
  }
}

/** Tujuan drill-down per warning. Untuk jadwal & tindak lanjut masih diarahkan ke
 *  /laporan — ganti jika ada halaman khusus. Halaman tujuan harus punya
 *  validateSearch untuk key `status` dan `kel` agar filter terbaca. */
export function warningTarget(w: Warning): {
  to: '/sasaran' | '/laporan'
  search: Record<string, string>
} {
  switch (w.type) {
    case 'sasaran_belum_dikunjungi':
    case 'cakupan_wilayah_rendah':
      return {
        to: '/sasaran',
        search: { status: 'Belum', ...(w.region ? { kel: w.region } : {}) },
      }
    default:
      return { to: '/laporan', search: w.region ? { kel: w.region } : {} }
  }
}
