/** Baris `data_warga` untuk warga sasaran utama, dibangun dari isian form kunjungan.
 *
 *  Dua sisi form — `KeluargaInfo` (header keluarga) dan `AnggotaKeluarga`
 *  (anggota) — tidak saling tunjuk field di model, padahal kepala keluarga
 *  sebenarnya adalah salah satu anggota. Jembatannya NIK: anggota yang NIK-nya
 *  sama dengan `info.nik` dianggap mewakili kepala keluarga, dan kolom
 *  `data_warga` yang tidak ada di `KeluargaInfo` diambil dari anggota itu.
 *
 *  Hampir semua kolom `data_warga` NOT NULL, sementara form boleh dipakai
 *  tanpa suggestion dari data import. Karena itu fungsi ini tidak pernah mengarang
 *  nilai: kolom yang tidak terisi dikembalikan lewat `hilang`, dan pemanggil
 *  menolak menyimpan sampai staff melengkapinya.
 *
 *  Label enum di sini adalah label yang dipakai kolom `data_warga` (lihat
 *  `src/lib/schema/type-enum.ts`). Opsi form memakai label pendek ("SMA",
 *  "Swasta", "L"), enum memakai label baku ("SLTA/Sederajat", "SWASTA",
 *  "laki-laki"). Semua terjemahan dikumpulkan di peta di bawah supaya tidak ada
 *  tebakan nilai enum di tempat lain.
 */
import type {
  AnggotaKeluarga,
  KeluargaInfo,
} from '@/lib/kunjungan-rumah/models'
import { isValidNik } from '@/lib/utils'
import {
  AGAMA_VALUES as ENUM_AGAMA,
  HUBUNGAN_KELUARGA_VALUES as ENUM_HUBUNGAN_KELUARGA,
  JENIS_KELAMIN_VALUES as ENUM_JENIS_KELAMIN,
  PEKERJAAN_VALUES as ENUM_PEKERJAAN,
  PENDIDIKAN_VALUES as ENUM_PENDIDIKAN,
  STATUS_KAWIN_VALUES as ENUM_STATUS_KAWIN,
} from '@/lib/schema/type-enum'

/** Label enum kolom `data_warga`. Sumber: `src/lib/schema/type-enum.ts`. */
export {
  ENUM_AGAMA,
  ENUM_HUBUNGAN_KELUARGA,
  ENUM_JENIS_KELAMIN,
  ENUM_PEKERJAAN,
  ENUM_PENDIDIKAN,
  ENUM_STATUS_KAWIN,
}

function label<T extends string>(
  daftar: readonly T[],
  v: string | null | undefined,
): T | null {
  const s = (v ?? '').trim()
  return (daftar as readonly string[]).includes(s) ? (s as T) : null
}

/* Opsi form -> label enum. Kunci = label opsi form seperti di seed
 * (`anggota::jk`, `anggota::pekerjaan`, dst), nilai = label enum `data_warga`.
 *
 * Pasangan yang sama ditulis eksplisit, bukan diasumsikan: `balancing` di bawah
 * memakai peta ini untuk mengisi `<select>`, jadi label enum yang juga merupakan
 * opsi form ("Kepala Keluarga", "PNS") harus punya pasangannya — kalau tidak,
 * select akan menampilkan kosong padahal nilainya sah.
 *
 * `pendidikan` dan `pekerjaan` tidak punya padanan satu-satu. Yang dipakai
 * adalah label enum terdekat; `Diploma I/II` dan `Strata III` sengaja tidak
 * dipakai karena tidak ada opsi form-nya. */
const DARI_JK: Record<string, string> = { L: 'laki-laki', P: 'perempuan' }
const DARI_HUB_KK: Record<string, string> = {
  'Kepala Keluarga': 'Kepala Keluarga',
  Istri: 'Istri',
  Anak: 'Anak',
  Menantu: 'Menantu',
  Cucu: 'Cucu',
  'Orang tua': 'Orang Tua',
  Mertua: 'Mertua',
  'Famili lain': 'Famili lain',
  Lainnya: 'Lainnya',
}
const DARI_KAWIN: Record<string, string> = {
  Kawin: 'kawin',
  'Belum kawin': 'belum kawin',
  'Cerai hidup': 'cerai hidup',
  'Cerai mati': 'cerai mati',
}
const DARI_PENDIDIKAN: Record<string, string> = {
  'Tidak sekolah': 'Tidak/Belum Sekolah',
  SD: 'Tamat SD/Sederajat',
  SMP: 'SLTP/Sederajat',
  SMA: 'SLTA/Sederajat',
  'D1/D3': 'Akademi/Diploma III/ Sarjana Muda',
  S1: 'Diploma IV/Strata I',
  'S2/S3': 'Strata-II',
}
const DARI_PEKERJAAN: Record<string, string> = {
  Petani: 'Petani',
  Buruh: 'Buruh',
  Nelayan: 'Nelayan',
  PNS: 'PNS',
  Pedagang: 'Pedagang',
  Swasta: 'SWASTA',
  IRT: 'IRT',
  'Pelajar/Mahasiswa': 'Pelajar/Mahasiswa',
  'Tidak bekerja': 'Tidak Bekerja',
  Lainnya: 'Lainnya',
}

function dariPeta(peta: Record<string, string>, v: string): string | null {
  const s = v.trim()
  if (!s) return null
  if (s in peta) return peta[s]!
  return null
}

export const keAgama = (v: string | null | undefined) => label(ENUM_AGAMA, v)
export const keJenisKelamin = (v: string | null | undefined) =>
  label(
    ENUM_JENIS_KELAMIN,
    dariPeta(DARI_JK, (v ?? '').trim()) ?? (v ?? '').trim(),
  )
export const keHubunganKeluarga = (v: string | null | undefined) =>
  label(
    ENUM_HUBUNGAN_KELUARGA,
    dariPeta(DARI_HUB_KK, (v ?? '').trim()) ?? (v ?? '').trim(),
  )
export const keStatusKawin = (v: string | null | undefined) =>
  label(
    ENUM_STATUS_KAWIN,
    dariPeta(DARI_KAWIN, (v ?? '').trim()) ?? (v ?? '').trim(),
  )
export const kePendidikan = (v: string | null | undefined) =>
  label(
    ENUM_PENDIDIKAN,
    dariPeta(DARI_PENDIDIKAN, (v ?? '').trim()) ?? (v ?? '').trim(),
  )
export const kePekerjaan = (v: string | null | undefined) =>
  label(
    ENUM_PEKERJAAN,
    dariPeta(DARI_PEKERJAAN, (v ?? '').trim()) ?? (v ?? '').trim(),
  )

/* Peta balik: label enum -> label opsi form, supaya suggestion bisa langsung
 * mengisi <select> di form. Label enum yang tidak ada padanan form dibuang. */
function balik(peta: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [opsi, nilai] of Object.entries(peta)) out[nilai] = opsi
  return out
}
const KE_JK = balik(DARI_JK)
const KE_HUB_KK = balik(DARI_HUB_KK)
const KE_KAWIN = balik(DARI_KAWIN)
const KE_PENDIDIKAN = balik(DARI_PENDIDIKAN)
const KE_PEKERJAAN = balik(DARI_PEKERJAAN)

export const opsiJk = (v: string | null | undefined) =>
  v ? (KE_JK[v] ?? '') : ''
export const opsiHubKK = (v: string | null | undefined) =>
  v ? (KE_HUB_KK[v] ?? '') : ''
export const opsiKawin = (v: string | null | undefined) =>
  v ? (KE_KAWIN[v] ?? '') : ''
export const opsiPendidikan = (v: string | null | undefined) =>
  v ? (KE_PENDIDIKAN[v] ?? '') : ''
export const opsiPekerjaan = (v: string | null | undefined) =>
  v ? (KE_PEKERJAAN[v] ?? '') : ''

/** Satu calon warga sasaran dari `data_warga` atau `data_warga_import`, sudah
 *  dinormalkan ke label enum DB. Kolom yang tidak ada padanan enum atau kosong
 *  bernilai `null` — pemanggil membiarkan kosong agar staff mengisinya sendiri,
 *  bukan ditebak. `rawId` berbeda sumber: NIK untuk warga tersimpan, `raw_id`
 *  untuk baris import. */
export interface SasaranSuggestion {
  rawId: string
  /**
   * Jumlah anggota keluarga yang tercatat pada baris import ini (`jumlah_art`).
   *
   * Hanya ada untuk baris `data_warga_import`; `null` untuk warga yang sudah
   * tersimpan di `data_warga` karena tabel itu tidak punya kolom tersebut.
   * Dipakai server untuk membatasi anggota yang ikut terisi otomatis.
   */
  jumlahArt?: number | null
  nik: string
  namaArt: string
  namaKk: string
  hubunganKeluarga: string | null
  tglLahir: string | null
  jenisKelamin: string | null
  statusKawin: string | null
  agama: string | null
  pendidikan: string | null
  /** `pekerjaan` di import tidak cocok enum pada 86% baris, jadi sering `null`. */
  pekerjaan: string | null
  alamat: string | null
  rt: string | null
  rw: string | null
  kecamatan: string | null
  kelurahan: string | null
  kabKota: string | null
  provinsi: string | null
}

export interface BarisWarga {
  nik: string
  nama_art: string
  nama_kk: string
  /** Lima kolom berikut adalah enum di Postgres, jadi tipenya union label —
   *  bukan `string`. `barisDataWargaDariForm` hanya mengembalikannya kalau
   *  `ke*` sudah mengenali labelnya, jadi union ini tidak pernah dilanggar. */
  hubungan_keluarga: (typeof ENUM_HUBUNGAN_KELUARGA)[number]
  alamat: string
  tgl_lahir: string
  rt: string
  rw: string
  kecamatan: string
  kelurahan: string
  kota: string
  status_kawin: (typeof ENUM_STATUS_KAWIN)[number]
  staff: string
  jenis_kelamin: (typeof ENUM_JENIS_KELAMIN)[number]
  wanita_usia_hamil: boolean
  agama: (typeof ENUM_AGAMA)[number]
  pendidikan: (typeof ENUM_PENDIDIKAN)[number]
  pekerjaan: (typeof ENUM_PEKERJAAN)[number]
}

export interface HasilBarisWarga {
  nilai: BarisWarga | null
  /** Nama kolom `data_warga` yang tidak punya sumber; kosong = siap insert. */
  hilang: string[]
}

function teks(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Anggota yang mewakili kepala keluarga: NIK-nya sama dengan NIK sasaran utama. */
export function anggotaKepalaKeluarga(
  anggota: AnggotaKeluarga[],
  nikSasaran: string,
): AnggotaKeluarga | null {
  const nik = nikSasaran.trim()
  if (!nik) return null
  return anggota.find((a) => a.nik.trim() === nik) ?? null
}

/**
 * Susun baris `data_warga` dari isian form.
 *
 * Urutan sumber per kolom:
 *  - isi form lebih dulu, karena itulah yang dikoreksi staff;
 *  - `suggestion` (baris import yang dipilih user) dipakai untuk kolom yang
 *    tidak ada di form — `rt`, `rw`, `agama` — dan sebagai cadangan kolom lain;
 *  - kolom yang tetap kosong dikembalikan lewat `hilang`, tidak diisi tebakan.
 */
export function barisDataWargaDariForm(input: {
  info: KeluargaInfo
  anggota: AnggotaKeluarga[]
  suggestion: SasaranSuggestion | null
}): HasilBarisWarga {
  const { info, anggota, suggestion } = input
  const nik = teks(info.nik)
  const kk = anggotaKepalaKeluarga(anggota, nik)

  const ambil = (
    dariForm: string,
    dariSuggestion: string | null | undefined,
  ): string => {
    const f = dariForm.trim()
    if (f) return f
    return (dariSuggestion ?? '').trim()
  }

  // `KeluargaInfo` punya index signature `string`, jadi akses `info.x` selalu
  // `string` — cukup `?? ""` untuk menyingkirkan `undefined` dari data lama.
  const kandidat = {
    nik,
    nama_art: ambil(kk?.nama ?? '', suggestion?.namaArt),
    nama_kk: ambil(info.namaKK, suggestion?.namaKk),
    alamat: ambil(info.alamat, suggestion?.alamat),
    tgl_lahir: ambil(kk?.tglLahir ?? '', suggestion?.tglLahir),
    rt: ambil(teks(info.rt), suggestion?.rt),
    rw: ambil(teks(info.rw), suggestion?.rw),
    kecamatan: ambil(info.kecamatan, suggestion?.kecamatan),
    kelurahan: ambil(info.kelurahan, suggestion?.kelurahan),
    kota: ambil(info.kabKota, suggestion?.kabKota),
    staff: teks(info.petugasId),
  }

  // Kolom enum. `kk` menang atas import kalau ada: isian anggota yang dikoreksi
  // staff lebih baru daripada data import.
  const relasi = {
    hubungan_keluarga: keHubunganKeluarga(
      kk?.hubKK || suggestion?.hubunganKeluarga,
    ),
    status_kawin: keStatusKawin(kk?.statusKawin || suggestion?.statusKawin),
    jenis_kelamin: keJenisKelamin(kk?.jk || suggestion?.jenisKelamin),
    // `agama` tidak ada di template keluarga default, jadi biasanya hanya bisa
    // datang dari import. `kk.agama` tetap dibaca lebih dulu: kalau admin
    // menambah field `agama` di section anggota lewat Form Builder, `kk.agama`
    // langsung terpakai tanpa perubahan kode ini.
    agama: keAgama(kk?.agama || suggestion?.agama),
    pendidikan: kePendidikan(kk?.pendidikan || suggestion?.pendidikan),
    pekerjaan: kePekerjaan(kk?.pekerjaan || suggestion?.pekerjaan),
  }

  if (!nik || !isValidNik(nik)) return { nilai: null, hilang: ['nik'] }

  const hilang = [
    ...Object.entries(kandidat)
      .filter(([k, v]) => k !== 'nik' && !v)
      .map(([k]) => k),
    ...Object.entries(relasi)
      .filter(([, v]) => v === null)
      .map(([k]) => k),
  ]
  if (kk === null) hilang.push('anggota')
  if (hilang.length > 0) return { nilai: null, hilang }

  return {
    nilai: {
      nik: kandidat.nik,
      nama_art: kandidat.nama_art,
      nama_kk: kandidat.nama_kk,
      alamat: kandidat.alamat,
      tgl_lahir: kandidat.tgl_lahir,
      rt: kandidat.rt,
      rw: kandidat.rw,
      kecamatan: kandidat.kecamatan,
      kelurahan: kandidat.kelurahan,
      kota: kandidat.kota,
      staff: kandidat.staff,
      // Non-null aman: `relasi` kosong berarti fungsi sudah mengembalikan
      // `nilai: null` di atas.
      hubungan_keluarga: relasi.hubungan_keluarga!,
      status_kawin: relasi.status_kawin!,
      jenis_kelamin: relasi.jenis_kelamin!,
      agama: relasi.agama!,
      pendidikan: relasi.pendidikan!,
      pekerjaan: relasi.pekerjaan!,
      // Tidak ada sumber di form maupun di data import; default aman sampai
      // ada field khusus. Lihat catatan di header file.
      wanita_usia_hamil: false,
    },
    hilang: [],
  }
}
