/**
 * Resolver sumber opsi dinamis untuk Form Builder.
 *
 * Sebagian field tidak menyimpan pilihan jawabannya di `form_field_options`,
 * melainkan menunjuk ke data yang sudah ada lewat `form_fields.optionSourceType`
 * / `optionSourceKey` (lihat `form_fields` di `src/lib/schema/schema.ts`).
 * Contohnya field "Petugas" di Form Kegiatan Pemberождения, yang opsinya adalah
 * akun `users` yang aktif dan berperan staff atau kader.
 *
 * Kenapa begini, bukan menyimpan pilihan jawaban di `form_field_options`:
 * daftar petugas dan daftar fasilitas berubah setiap kali admin menambah atau
 * menonaktifkan data di /kelola. Kalau opsinya ikut disimpan, setiap perubahan
 * ikut mengubah isi form, dan form yang sudah pernah diisi jadi tidak konsisten
 * dengan yang dicatat petugas. Dengan menunjuk ke sumber asalnya, opsinya
 * selalu mengikuti data terbaru, dan submission lama tetap menyimpan nilai yang
 * benar saat itu (mis. `users.id`).
 *
 * Katalog sumber (label, kelompok, tipe yang boleh memakai) ada di
 * `sumber-opsi.ts` dan bebas import server — file itu yang dipakai panel
 * pengaturan di browser. File ini hanya menambahkan bagian yang harus menyentuh
 * database.
 *
 * CATATAN JUJUR SOAL BATASNYA: resolver mengembalikan pilihan berdasarkan state
 * database saat form dirender atau disimpan. Kalau seorang petugas dinonaktifkan
 * setelah form dibuka tapi sebelum dikirim, pilihannya bisa saja sudah tidak
 * berlaku. `pastikanPetugasValid()` menutup celah itu di sisi server, jadi form
 * yang terlanjur terbuka tidak bisa menyimpan petugas yang sudah dinonaktifkan.
 */
import { isNotNull } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import { listPetugasOpsi } from '@/lib/server/petugas/user-registry.server'
import {
  fasilitasKesehatan,
  dataWargaTable,
  wilayahKerja,
} from '@/lib/schema/schema'
import { riwayatKsImport } from '@/lib/schema/data-import'
import {
  BATAS_NILAI_DISTINCT,
  cariSumber,
  nilaiEnum,
  SUMBER_CARI_WARGA,
  SUMBER_SUGGEST,
} from '@/lib/service/form-builder/sumber-opsi'

export interface OpsiDinamis {
  /** Nilai yang disimpan di `survey_entries.value`. Untuk petugas ini `users.id`. */
  value: string
  /** Teks yang dilihat petugas. */
  label: string
}

export interface HasilResolverOpsi {
  opsi: OpsiDinamis[]
  /**
   * true kalau sumbernya tidak dikenali ATAU hasilnya kosong. UI bisa
   * menampilkan peringatan supaya masalah konfigurasi field terlihat, bukan
   * muncul sebagai dropdown kosong yang membingungkan.
   */
  sumberTidakDikenali: boolean
  /** Label sumber untuk ditampilkan di layar isi, mis. "Agama". */
  label: string | null
  /**
   * Daftar saran untuk auto-complete (hanya `suggest`). Field teks boleh diisi
   * bebas, jadi ini tidak pernah membatasi jawaban.
   */
  saran: string[]
}

const KOSONG: HasilResolverOpsi = {
  opsi: [],
  sumberTidakDikenali: false,
  label: null,
  saran: [],
}

/** Petugas: staff dan kader aktif. `fasKesId` null = semua fasilitas. */
async function opsiPetugas(fasKesId: number | null): Promise<OpsiDinamis[]> {
  const petugas = await listPetugasOpsi(fasKesId)
  return petugas.map((p) => ({ value: p.id, label: `${p.nama} — ${p.fasKes}` }))
}

/** Fasilitas kesehatan aktif; `key` = `nama` (baris tabel) atau `jenis` (enum). */
async function opsiFaskes(key: string): Promise<OpsiDinamis[]> {
  if (key === 'jenis') {
    const values = nilaiEnum('jenis') ?? []
    return values.map((v) => ({ value: v, label: v }))
  }

  const baris = await db
    .select({
      id: fasilitasKesehatan.id,
      nama: fasilitasKesehatan.nama,
      jenis: fasilitasKesehatan.fasKesType,
    })
    .from(fasilitasKesehatan)
    .orderBy(fasilitasKesehatan.nama)

  return baris.map((b) => ({
    value: String(b.id),
    label: `${b.nama} — ${b.jenis}`,
  }))
}

/** Kecamatan atau kelurahan dari `wilayah_kerja`. Value berupa teks, bukan id. */
async function opsiWilayah(key: string): Promise<OpsiDinamis[]> {
  const kolom =
    key === 'kecamatan' ? wilayahKerja.kecamatan : wilayahKerja.kelurahan
  const baris = await db
    .selectDistinct({ nilai: kolom })
    .from(wilayahKerja)
    .orderBy(kolom)

  return baris.map((b) => ({ value: b.nilai, label: b.nilai }))
}

/**
 * Nilai distinct dari data warga atau riwayat kesehatan keluarga.
 *
 * `nama_art` dan `alamat` diambil dengan batas: `data_warga` berisi puluhan
 * ribu baris dengan nilai bebas teks, jadi seluruh isinya tidak pernah dikirim
 * ke satu dropdown. Sisanya — kelurahan, kecamatan, dan kolom riwayat — pendek
 * dan kategori, jadi batasnya tidak membatasi apa pun.
 */
async function opsiWarga(key: string): Promise<OpsiDinamis[]> {
  if (key === 'jenis_jamban_saniter' || key === 'jenis_sumber_air_terlindung') {
    const kolom =
      key === 'jenis_jamban_saniter'
        ? riwayatKsImport.jenisJambanSaniter
        : riwayatKsImport.jenisSumberAirTerlindung

    const baris = await db
      .selectDistinct({ nilai: kolom })
      .from(riwayatKsImport)
      .where(isNotNull(kolom))
      .orderBy(kolom)

    return baris
      .map((b) => (b.nilai ?? '').trim())
      .filter((v) => v !== '')
      .map((v) => ({ value: v, label: v }))
  }

  const kolomWarga = {
    kelurahan: dataWargaTable.kelurahan,
    kecamatan: dataWargaTable.kecamatan,
    nama_art: dataWargaTable.nama_art,
    alamat: dataWargaTable.alamat,
  }[key]

  if (!kolomWarga) return []

  const baris = await db
    .selectDistinct({ nilai: kolomWarga })
    .from(dataWargaTable)
    .orderBy(kolomWarga)
    .limit(BATAS_NILAI_DISTINCT)

  return baris.map((b) => ({ value: b.nilai, label: b.nilai }))
}

/**
 * Daftar saran milik satu field: baris `form_field_options` miliknya.
 *
 * Bentuknya sama seperti opsi statis — sengaja, supaya terhapus dan ter-backup
 * bersama form. Bedanya hanya di sisi render: sarannya shown sebagai
 * auto-complete dan tidak membatasi jawaban petugas.
 */
function opsiSuggest(
  options: readonly { value: string; label: string; aktif: boolean }[],
): OpsiDinamis[] {
  return options
    .filter((option) => option.aktif)
    .map((option) => ({
      value: option.value,
      label: option.label || option.value,
    }))
}

/**
 * Ambil pilihan untuk satu field.
 *
 * `optionSourceType` null atau kosong berarti field ini memakai opsi statis dari
 * `form_field_options`; hasilnya kosong dan pemanggil harus pakai baris
 * `form_field_options`, bukan hasil fungsi ini.
 *
 * `fasKesId` membatasi pilihan ke satu fasilitas. null berarti semua fasilitas,
 * dan itu dipakai ketika pemanggil tidak tahu fasilitas mana yang relevan —
 * misalnya sesi login masih memakai PIN global sehingga tidak ada `users.id`
 * yang diketahui (lihat `useKaderAktif`).
 *
 * `fieldId` dibutuhkan hanya oleh sumber `suggest`, karena sarannya menempel di
 * field itu sendiri.
 */
export async function resolveOpsiDinamis(params: {
  optionSourceType: string | null | undefined
  optionSourceKey?: string | null
  fasKesId?: number | null
  fieldId?: string | null
  options?: readonly { value: string; label: string; aktif: boolean }[]
}): Promise<HasilResolverOpsi> {
  const { optionSourceType, optionSourceKey, fasKesId } = params
  if (!optionSourceType) return KOSONG

  const source = cariSumber(optionSourceType, optionSourceKey)
  if (!source) return { ...KOSONG, sumberTidakDikenali: true }

  let opsi: OpsiDinamis[]
  switch (optionSourceType) {
    case 'enum':
      opsi = (nilaiEnum(optionSourceKey ?? '') ?? []).map((v) => ({
        value: v,
        label: v,
      }))
      break
    case 'users':
      opsi = await opsiPetugas(fasKesId ?? null)
      break
    case 'faskes':
      opsi = await opsiFaskes(optionSourceKey ?? '')
      break
    case 'wilayah':
      opsi = await opsiWilayah(optionSourceKey ?? '')
      break
    case 'warga':
      opsi = await opsiWarga(optionSourceKey ?? '')
      break
    case SUMBER_SUGGEST:
      opsi = opsiSuggest(params.options ?? [])
      break
    case SUMBER_CARI_WARGA:
      // Sengaja tanpa query. Pencarian terjadi di browser tiap kali petugas
      // mengetik, bukan sekali saat form dibuka — jadi tidak ada daftar yang bisa
      // dikirim ke sini.
      //
      // Konsekuensi yang harus dijaga: `opsi` TIDAK BOLEH diisi hasil pencarian.
      // Kalau nanti diisi, `opsiSah()` di form-runtime.server.ts akan
      // memperlakukannya sebagai daftar jawaban dan menolak nilai yang diketik
      // manual saat simpan.
      // Karena kosong, `validasiNilaiOpsiTerpilih` meloloskan tipe `text` apa
      // pun — saran tidak membatasi jawaban, sama seperti `suggest`.
      opsi = []
      break
    default:
      // Seharusnya tidak terjadi: `validasiSumberOpsi` menolak type tak dikenal saat build.
      return { ...KOSONG, sumberTidakDikenali: true }
  }

  // Daftar kosong dianggap sumber tidak dikenali, sama perlakuan dengan
  // `users`: dropdown kosong tanpa penjelasan lebih membingungkan daripada
  // banner "perbaiki di Kelola". Pengecualiannya dua sumber yang memang tidak
  // punya daftar: `suggest` (daftar sarannya boleh kosong karena petugas tetap
  // boleh mengisi bebas) dan `cari_warga` (pencariannya nanti saat mengetik).
  const tanpaDaftar =
    optionSourceType === SUMBER_SUGGEST ||
    optionSourceType === SUMBER_CARI_WARGA

  return {
    opsi,
    sumberTidakDikenali: opsi.length === 0 && !tanpaDaftar,
    label: source.label,
    saran: optionSourceType === SUMBER_SUGGEST ? opsi.map((o) => o.label) : [],
  }
}

/** Daftar key sumber `warga` yang boleh dipakai; katalog adalah acuan. */
