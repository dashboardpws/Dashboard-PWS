import type { PenilaianForm } from './models'

type KunciAnggota = {
  nik?: unknown
  nama?: unknown
  namaArt?: unknown
  tglLahir?: unknown
  tanggalLahir?: unknown
  hubKK?: unknown
  hubunganKeluarga?: unknown
}

export type PenilaianRiwayat = Omit<PenilaianForm, 'id' | 'anggotaId'>

function teks(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function normal(v: string): string {
  return v.replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')
}

/** Identitas stabil untuk menautkan isian lama ke anggota form yang baru. */
export function getMemberKey(anggota: KunciAnggota): string | null {
  return getMemberKeys(anggota)[0] ?? null
}

export function getMemberKeys(anggota: KunciAnggota): string[] {
  const nik = teks(anggota.nik)
  if (nik) return [`nik:${nik}`]

  const nama = normal(teks(anggota.nama) || teks(anggota.namaArt))
  if (!nama) return []
  const tglLahir = teks(anggota.tglLahir) || teks(anggota.tanggalLahir)
  const hubungan = normal(teks(anggota.hubKK) || teks(anggota.hubunganKeluarga))
  return [
    ...(tglLahir ? [`name_dob:${nama}_${tglLahir}`] : []),
    ...(hubungan ? [`name_relation:${nama}_${hubungan}`] : []),
  ]
}

function normalisasiPenilaian(value: unknown): PenilaianRiwayat | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.sasaran !== 'string') return null
  const values =
    row.values && typeof row.values === 'object' && !Array.isArray(row.values)
      ? (Object.fromEntries(
          Object.entries(row.values).filter(([, v]) => typeof v === 'string'),
        ) as Record<string, string>)
      : {}
  const checks =
    row.checks && typeof row.checks === 'object' && !Array.isArray(row.checks)
      ? (Object.fromEntries(
          Object.entries(row.checks).filter(([, v]) => typeof v === 'boolean'),
        ) as Record<string, boolean>)
      : {}
  return {
    sasaran: row.sasaran as PenilaianForm['sasaran'],
    values,
    checks,
    prioritas: Array.isArray(row.prioritas)
      ? row.prioritas.filter((v): v is string => typeof v === 'string')
      : [],
  }
}

function daftar(value: unknown): PenilaianRiwayat[] {
  const rows = Array.isArray(value) ? value : [value]
  return rows.flatMap((row) => {
    const penilaian = normalisasiPenilaian(row)
    return penilaian ? [penilaian] : []
  })
}

/**
 * Baca map penilaian baru atau bangun ulang dari bentuk payload lama.
 * Payload legacy menyimpan array penilaian yang menunjuk ID anggota lokal.
 */
export function buildPenilaianMapFromSubmission(
  payload: unknown,
): Record<string, PenilaianRiwayat[]> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return {}
  const rec = payload as Record<string, unknown>
  const map: Record<string, PenilaianRiwayat[]> = {}
  const penilaianBaru = rec.penilaianByNik

  if (
    penilaianBaru &&
    typeof penilaianBaru === 'object' &&
    !Array.isArray(penilaianBaru)
  ) {
    for (const [key, value] of Object.entries(penilaianBaru)) {
      const normalizedKey = /^\d{16}$/.test(key) ? `nik:${key}` : key
      map[normalizedKey] = daftar(value)
    }
    return map
  }

  const anggotaRaw = Array.isArray(rec.anggota)
    ? rec.anggota
    : Array.isArray(rec.anggotaKeluarga)
      ? rec.anggotaKeluarga
      : []
  const lama = rec.penilaian
  const lamaById =
    lama && typeof lama === 'object' && !Array.isArray(lama)
      ? (lama as Record<string, unknown>)
      : null
  const lamaRows = Array.isArray(lama) ? lama : []

  for (const raw of anggotaRaw) {
    if (!raw || typeof raw !== 'object') continue
    const anggota = raw as KunciAnggota & { id?: unknown }
    const keys = getMemberKeys(anggota)
    const id = teks(anggota.id)
    if (!keys.length || !id) continue
    const rows = lamaRows.filter(
      (row) =>
        !!row &&
        typeof row === 'object' &&
        teks((row as Record<string, unknown>).anggotaId) === id,
    )
    const oldValue = lamaById?.[id]
    const hasil = [...daftar(rows), ...daftar(oldValue)]
    if (hasil.length) for (const key of keys) map[key] = hasil
  }

  return map
}
