import { pctOf } from '@/lib/utils'
import type { BarisPrioritas } from '@/lib/prioritas/prioritas'
import { kunjunganLebihBaru } from './warning'

/*
 * Ringkasan prioritas program per kelurahan untuk drawer dashboard.
 *
 * Sumber satu-satunya adalah `penilaian[].prioritas` di payload kunjungan rumah:
 * kode `TB`, `Bumil Risti`, `Balita Risti`, atau prioritas custom dari menu
 * Prioritas. Tidak ada kolom prioritas di `data_warga`, jadi warga yang belum
 * pernah dikunjungi tidak boleh dianggap "tanpa prioritas" — datanya memang
 * belum ada.
 *
 * Aturan yang dipegang di sini:
 * - Status diambil dari kunjungan TERBARU yang menyebut NIK warga itu. Kalau
 *   kunjungan terbaru tidak menulis prioritas, prioritas lama dianggap gugur.
 * - Persen dihitung dari total warga kelurahan, bukan dari warga yang sudah
 *   dikunjungi, supaya "3% TB" berarti 3% dari seluruh warga kelurahan.
 * - Satu warga boleh punya beberapa prioritas. Karena itu jumlah persen semua
 *   baris bisa lebih dari 100%; itu komposisi, bukan pembagian eksklusif.
 *
 * Fungsi ini murni (tanpa DB) supaya aturan hitung di atas bisa diuji langsung.
 */

export interface WargaKelurahan {
  nik: string
  nama: string
  kelurahan: string
  /** Ref publik untuk URL `/sasaran/$ref`. */
  ref: string
}

/**
 * Bentuk minimal satu record kunjungan rumah. Field jsonb sengaja bertipe
 * `unknown`: payload lama dan baru tidak selalu sama bentuknya, jadi
 * normalisasinya dilakukan di sini, bukan di query server.
 */
export interface KunjunganPrioritas {
  nik?: string | null
  tanggal?: string | null
  waktuSimpan?: string | null
  anggota?: unknown
  penilaian?: unknown
  penilaianByNik?: unknown
}

export interface WargaPrioritasRingkas {
  nama: string
  ref: string
  /** Tanggal kunjungan terakhir yang menjadi sumber prioritas ini. */
  tanggal: string
}

export interface BarisPrioritasKelurahan {
  kode: string
  nama: string
  jumlah: number
  /** Persen dari total warga kelurahan. */
  pct: number
  /** Contoh warga, dibatasi `batasWarga`. */
  warga: WargaPrioritasRingkas[]
  wargaLainnya: number
}

export interface PrioritasKelurahan {
  kelurahan: string
  total: number
  dikunjungi: number
  belumDikunjungi: number
  /** Sudah dikunjungi dan punya ≥1 prioritas. */
  denganPrioritas: number
  /** Sudah dikunjungi, tetapi tidak ada prioritas tercatat di kunjungan terbaru. */
  tanpaPrioritas: number
  prioritas: BarisPrioritasKelurahan[]
}

export const BATAS_WARGA_PRIORITAS = 5

function teks(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function rekaman(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function larik(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function bacaPrioritas(v: unknown): string[] {
  return larik(v)
    .map(teks)
    .filter((kode) => kode.length > 0)
}

function tambahPrioritas(
  map: Map<string, string[]>,
  nik: string,
  kode: string[],
): void {
  if (!nik) return
  const sekarang = map.get(nik) ?? []
  map.set(nik, [...new Set([...sekarang, ...kode])])
}

/**
 * Prioritas per NIK dari satu record kunjungan.
 *
 * `penilaian[].anggotaId` menunjuk `anggota[].id`, bukan NIK. NIK baru bisa
 * dipakai kalau id itu ketemu. Kalau tidak ketemu dan keluarganya hanya punya
 * ≤1 anggota, seluruh penilaian record itu aman diatribusikan ke `info.nik`
 * (kepala keluarga). Selain itu dilewati — menebak lebih berbahaya daripada
 * kehilangan satu baris data.
 *
 * Bentuk lama `penilaianByNik` (map NIK → penilaian) tetap dibaca supaya record
 * generasi sebelumnya tidak hilang dari rekap.
 */
function prioritasPerNik(k: KunjunganPrioritas): Map<string, string[]> {
  const hasil = new Map<string, string[]>()
  const anggota = larik(k.anggota).flatMap((raw) => {
    const row = rekaman(raw)
    return row ? [row] : []
  })
  const nikById = new Map<string, string>()
  for (const a of anggota) {
    const id = teks(a.id)
    const nik = teks(a.nik)
    if (id && nik) nikById.set(id, nik)
  }

  const penilaian = larik(k.penilaian).flatMap((raw) => {
    const row = rekaman(raw)
    return row ? [row] : []
  })
  for (const p of penilaian) {
    const nik = nikById.get(teks(p.anggotaId))
    if (!nik) continue
    // Tetap dicatat walau kosong: kunjungan terbaru yang menghapus prioritas
    // harus menimpa prioritas lama, bukan dilewati.
    tambahPrioritas(hasil, nik, bacaPrioritas(p.prioritas))
  }

  // Fallback hanya kalau tidak ada anggota lain yang bisa tertukar: keluarga
  // tanpa anggota, atau satu anggota tanpa NIK / NIK-nya sama dengan kepala
  // keluarga. Kalau anggota tunggal itu NIK lain, atribusi ke `info.nik` salah.
  const nikKk = teks(k.nik)
  const satuAnggota = anggota.length === 1 ? (anggota[0] ?? null) : null
  const bolehFallback =
    !!nikKk &&
    (anggota.length === 0 ||
      (satuAnggota !== null &&
        (!teks(satuAnggota.nik) || teks(satuAnggota.nik) === nikKk)))
  if (hasil.size === 0 && bolehFallback && penilaian.length > 0) {
    const semua = penilaian.flatMap((p) => bacaPrioritas(p.prioritas))
    tambahPrioritas(hasil, nikKk, semua)
  }

  const legacy = rekaman(k.penilaianByNik)
  if (legacy) {
    for (const [kunci, nilai] of Object.entries(legacy)) {
      const nik = kunci.startsWith('nik:') ? kunci.slice(4) : kunci
      if (!nik || hasil.has(nik)) continue
      const baris = larik(nilai).flatMap((raw) => {
        const row = rekaman(raw)
        return row ? [row] : []
      })
      const kode = baris.length
        ? baris.flatMap((row) => bacaPrioritas(row.prioritas))
        : bacaPrioritas(nilai)
      tambahPrioritas(hasil, nik, kode)
    }
  }

  return hasil
}

interface PrioritasTerbaru {
  tanggal: string
  waktuSimpan: string
  prioritas: string[]
}

/** Per NIK, simpan prioritas dari kunjungan terbaru yang menyebut NIK itu. */
function prioritasTerbaru(
  kunjungan: readonly KunjunganPrioritas[],
): Map<string, PrioritasTerbaru> {
  const terbaru = new Map<string, PrioritasTerbaru>()
  for (const k of kunjungan) {
    const waktuSimpan = teks(k.waktuSimpan)
    const tanggal = teks(k.tanggal) || waktuSimpan.slice(0, 10)
    for (const [nik, prioritas] of prioritasPerNik(k)) {
      const sekarang = terbaru.get(nik)
      if (
        !sekarang ||
        kunjunganLebihBaru(
          { tanggal, waktuSimpan },
          { tanggal: sekarang.tanggal, waktuSimpan: sekarang.waktuSimpan },
        )
      ) {
        terbaru.set(nik, { tanggal, waktuSimpan, prioritas })
      }
    }
  }
  return terbaru
}

interface KelurahanAgg {
  kelurahan: string
  total: number
  dikunjungi: number
  belumDikunjungi: number
  denganPrioritas: number
  tanpaPrioritas: number
  wargaPerKode: Map<string, WargaPrioritasRingkas[]>
}

function buatBarisPrioritas(
  kode: string,
  nama: string,
  daftar: WargaPrioritasRingkas[],
  total: number,
  batasWarga: number,
): BarisPrioritasKelurahan {
  const warga = daftar.slice(0, batasWarga)
  return {
    kode,
    nama,
    jumlah: daftar.length,
    pct: pctOf(daftar.length, total),
    warga,
    wargaLainnya: Math.max(0, daftar.length - warga.length),
  }
}

export interface HitungPrioritasInput {
  warga: readonly WargaKelurahan[]
  /** NIK yang sudah punya ≥1 isian form; sumbernya sama dengan cakupan kartu. */
  dikunjungi: ReadonlySet<string> | readonly string[]
  kunjungan: readonly KunjunganPrioritas[]
  daftarPrioritas: readonly BarisPrioritas[]
  batasWarga?: number
}

export function hitungPrioritasKelurahan({
  warga,
  dikunjungi,
  kunjungan,
  daftarPrioritas,
  batasWarga = BATAS_WARGA_PRIORITAS,
}: HitungPrioritasInput): PrioritasKelurahan[] {
  const visited =
    dikunjungi instanceof Set ? dikunjungi : new Set<string>(dikunjungi)
  const terbaru = prioritasTerbaru(kunjungan)
  const perKelurahan = new Map<string, KelurahanAgg>()

  for (const w of warga) {
    const kelurahan = w.kelurahan || 'Tidak diketahui'
    let agg = perKelurahan.get(kelurahan)
    if (!agg) {
      agg = {
        kelurahan,
        total: 0,
        dikunjungi: 0,
        belumDikunjungi: 0,
        denganPrioritas: 0,
        tanpaPrioritas: 0,
        wargaPerKode: new Map(),
      }
      perKelurahan.set(kelurahan, agg)
    }

    agg.total += 1
    if (!visited.has(w.nik)) {
      agg.belumDikunjungi += 1
      continue
    }

    agg.dikunjungi += 1
    const catatan = terbaru.get(w.nik)
    const kode = catatan?.prioritas ?? []
    if (kode.length === 0) {
      agg.tanpaPrioritas += 1
      continue
    }

    agg.denganPrioritas += 1
    for (const k of kode) {
      const daftar = agg.wargaPerKode.get(k) ?? []
      daftar.push({
        nama: w.nama,
        ref: w.ref,
        tanggal: catatan?.tanggal ?? '',
      })
      agg.wargaPerKode.set(k, daftar)
    }
  }

  const master = new Map(daftarPrioritas.map((item) => [item.kode, item]))
  const urutMaster = [...daftarPrioritas].sort(
    (a, b) => a.urutan - b.urutan || a.id - b.id,
  )

  return [...perKelurahan.values()]
    .sort((a, b) => a.kelurahan.localeCompare(b.kelurahan, 'id-ID'))
    .map((agg) => {
      const prioritas: BarisPrioritasKelurahan[] = []
      for (const item of urutMaster) {
        const daftar = agg.wargaPerKode.get(item.kode) ?? []
        // Prioritas nonaktif tetap tampil kalau ada warganya: datanya nyata,
        // menyembunyikannya justru membuat angka tidak bisa ditelusuri.
        if (!item.aktif && daftar.length === 0) continue
        prioritas.push(
          buatBarisPrioritas(
            item.kode,
            item.nama,
            daftar,
            agg.total,
            batasWarga,
          ),
        )
      }
      const kodeLain = [...agg.wargaPerKode.keys()]
        .filter((kode) => !master.has(kode))
        .sort((a, b) => a.localeCompare(b, 'id-ID'))
      for (const kode of kodeLain) {
        prioritas.push(
          buatBarisPrioritas(
            kode,
            kode,
            agg.wargaPerKode.get(kode) ?? [],
            agg.total,
            batasWarga,
          ),
        )
      }

      return {
        kelurahan: agg.kelurahan,
        total: agg.total,
        dikunjungi: agg.dikunjungi,
        belumDikunjungi: agg.belumDikunjungi,
        denganPrioritas: agg.denganPrioritas,
        tanpaPrioritas: agg.tanpaPrioritas,
        prioritas,
      }
    })
}
