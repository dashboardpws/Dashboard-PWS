import {
  querySurveyStatsByNik,
  queryWargaImportUntukCakupan,
} from './sasaran.server'

/** Cakupan satu kelurahan untuk kartu ringkasan dashboard. */
export interface KelurahanStat {
  name: string
  total: number
  dikunjungi: number
  pct: number
  sub: string
}

/**
 * Cakupan kunjungan per kelurahan: berapa warga tercatat dan berapa yang sudah
 * punya ≥1 submission. Denominator berasal dari data import, agar warga yang
 * baru masuk `data_warga` setelah dikunjungi tidak menghilang dari target.
 *
 * Dipakai dashboard DAN halaman notifikasi, jadi perhitungannya hanya ada di
 * sini — keduanya harus menghitung "sasaran belum dikunjungi" dengan angka yang
 * sama, kalau tidak notifikasi dan dashboard bisa melaporkan jumlah berbeda.
 */
export function kelurahanStatDari(
  warga: Array<{ nik: string | null; kelurahan: string | null }>,
  stats: Array<{ nik: string }>,
): KelurahanStat[] {
  const visited = new Set(stats.map((s) => s.nik))
  const byKel = new Map<
    string,
    { name: string; total: number; dikunjungi: number }
  >()
  for (const w of warga) {
    const name = w.kelurahan?.trim() ?? ''
    if (!name) continue
    const key = name.toLocaleLowerCase('id-ID')
    const cur = byKel.get(key) ?? { total: 0, dikunjungi: 0, name }
    cur.total += 1
    if (w.nik && visited.has(w.nik.trim())) cur.dikunjungi += 1
    byKel.set(key, cur)
  }
  return [...byKel.values()].map((v) => ({
    name: v.name,
    total: v.total,
    dikunjungi: v.dikunjungi,
    pct: v.total ? Math.round((v.dikunjungi / v.total) * 100) : 0,
    sub: `${v.dikunjungi} / ${v.total} jiwa dikunjungi`,
  }))
}

export async function queryKelurahanStats(): Promise<KelurahanStat[]> {
  const [wargaImport, stats] = await Promise.all([
    queryWargaImportUntukCakupan(),
    querySurveyStatsByNik(),
  ])
  return kelurahanStatDari(wargaImport, stats)
}
