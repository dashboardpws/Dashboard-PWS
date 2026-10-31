/**
 * Validasi murni untuk Form Builder.
 *
 * Semua fungsi di file ini TIDAK menyentuh database, jadi bisa diuji tanpa DB.
 * Bagian yang butuh query database ada di `*.server.ts` dan memanggil fungsi ini
 * setelah data diambil.
 *
 * Kenapa validasi versi tidak dijamin database: composite FK untuk
 * `survey_entries.fieldId` butuh trigger supaya pesannya bisa dibaca petugas, dan
 * trigger itu sulit dirawat. Aturan "satu form satu versi published" juga dijaga
 * di `terbitkanVersiForm()`, di dalam transaksi publish.
 */

import { isValidNik } from '@/lib/utils'
import { cariSumber, SUMBER_CARI_WARGA, SUMBER_SUGGEST } from './sumber-opsi'

export type KodeValidasi =
  | 'OPSI_KOSONG'
  | 'OPSI_TIDAK_VALID'
  | 'VERSI_BUKAN_DRAFT'
  | 'VERSI_SUDAH_TERBIT'
  | 'VERSI_TIDAK_ADA'
  | 'SURVEI_TIDAK_ADA'
  | 'FIELD_TIDAK_ADA'
  | 'ATURAN_AUTOFILL_DUPLIKAT'
  | 'FIELD_TERPAKAI'
  | 'NILAI_TIDAK_COCOK'
  | 'NIK_TIDAK_VALID'
  | 'GROUP_BARIS_SISIP'
  | 'GROUP_BARIS_TERLALU_BANYAK'
  | 'GROUP_NILAI_SISIP'
  | 'NAMA_FIELD_BENTARAK'
  | 'NAMA_FIELD_TIDAK_VALID'
  | 'KOLOM_GROUP_KOSONG'
  | 'OPSI_FIELD_KOSONG'
  | 'SUMBER_OPSI_TIDAK_DIKENAL'
  | 'SUMBER_OPSI_TIPE_SALAH'
  | 'NAMA_FORM_BENTARAK'
  | 'FORM_BAWAAN'
  | 'STRUKTUR_BAWAAN_DIKUNCI'
  | 'FORM_PUNYA_ISIAN'
  | 'KONFIRMASI_NAMA_SALAH'
  | 'DRAFT_BAWAAN_TERKUNCI'
  | 'VERSI_HANYA_SATU'

export type HasilValidasi =
  { ok: true } | { ok: false; kode: KodeValidasi; pesan: string }

const lolos: HasilValidasi = { ok: true }

function gagal(kode: KodeValidasi, pesan: string): HasilValidasi {
  return { ok: false, kode, pesan }
}

export type TipeField =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'time'
  | 'image'
  | 'file'
  | 'group'

/**
 * Tipe field yang boleh dipilih di editor, urut sesuai tampilannya di UI.
 *
 * Disalin dari enum `form_field_type` di database, bukan dibaca dari sana:
 * enum itu datang dari drizzle pg-core, dan mengimpornya ke komponen editor
 * menarik drizzle ke bundle klien. Konsekuensinya menambah tipe di database
 * berarti daftar ini harus ikut ditambah — sama seperti enum `audit_action`.
 */
export const SEMUA_TIPE_FIELD: readonly TipeField[] = [
  'text',
  'textarea',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
  'time',
  'image',
  'file',
  'group',
]

/** Tipe yang jawabannya dipilih dari daftar, jadi butuh opsi. */
export const TIPE_BUTUH_OPSI: readonly TipeField[] = [
  'select',
  'radio',
  'checkbox',
]

/**
 * Batas atas jumlah baris untuk satu field `group`.
 *
 * Nilai ini hanya divalidasi di backend, bukan lewat CHECK di database, karena
 * array-nya disimpan di `survey_entries.value` (jsonb) yang tidak bisa punya
 * constraint per-isi. Dipasang supaya satu field yang tidak sengaja dikirim
 * dengan array sangat besar tidak bisa membebani tabel: array 100rb baris akan
 * lolos validasi bentuk lalu menggagalkan seluruh transaksi saat di-insert.
 */
export const MAX_BARIS_GROUP = 500

/** Nilai yang boleh muncul di dalam satu sel group. */
type NilaiGroup = string | number | boolean | null

function selGroupValid(nilai: unknown): nilai is NilaiGroup {
  return (
    typeof nilai === 'string' ||
    typeof nilai === 'number' ||
    typeof nilai === 'boolean' ||
    nilai === null
  )
}

/**
 * Field `group` menyimpan baris berulang (anggota keluarga, daftar peserta,
 * daftar masalah) sebagai array of object di dalam satu baris `survey_entries`.
 * Kolom `value` jsonb sudah bisa menampungnya, jadi tidak ada tabel anak.
 *
 * Yang dicek: harus array, tiap baris harus object biasa (bukan array atau
 * object bersarang), nilai di dalam sel harus primitif, dan jumlah baris tidak
 * melebihi batas. Bentuk object flattened (`{kolom1, kolom2, ...}`) yang
 * dipakai komponen editor; struktur kolom anak tidak disimpan di database,
 * jadi `jumlahKolom` tidak ikut divalidasi di sini.
 */
export function validasiNilaiGroup(params: {
  value: unknown
  maxBaris?: number
}): HasilValidasi {
  const { value, maxBaris = MAX_BARIS_GROUP } = params

  if (!Array.isArray(value)) {
    return gagal('GROUP_BARIS_SISIP', 'Field group harus diisi daftar baris.')
  }
  if (value.length > maxBaris) {
    return gagal(
      'GROUP_BARIS_TERLALU_BANYAK',
      `Field group maksimal ${maxBaris} baris, terkirim ${value.length}.`,
    )
  }

  for (const [i, baris] of value.entries()) {
    if (typeof baris !== 'object' || baris === null || Array.isArray(baris)) {
      return gagal(
        'GROUP_NILAI_SISIP',
        `Baris ${i + 1} pada field group harus berupa objek, bukan ${Array.isArray(baris) ? 'daftar' : typeof baris}.`,
      )
    }
    for (const [kolom, isi] of Object.entries(
      baris as Record<string, unknown>,
    )) {
      if (!selGroupValid(isi)) {
        return gagal(
          'GROUP_NILAI_SISIP',
          `Nilai kolom "${kolom}" pada baris ${i + 1} harus teks, angka, atau boolean.`,
        )
      }
    }
  }

  return lolos
}

export interface OpsiField {
  value: string
  aktif?: boolean
}

/**
 * Field select/radio/checkbox tanpa opsi tidak bisa diisi, jadi petugas akan
 * melihat pertanyaan yang mustahil dijawab. Divalidasi saat simpan, bukan saat render.
 *
 * Pengecualian: field yang optsinya datang dari sumber dinamis (mis. daftar
 * petugas dari tabel `users`) memang tidak punya baris di `form_field_options`.
 * Untuk field itu aturan "wajib punya opsi" tidak berlaku, karena opsinya dibaca
 * dari database saat render dan saat penyimpanan. Yang tetap diperiksa adalah
 * value-nya: apakah nilai yang dikirim benar-benar salah satu opsi yang berlaku
 * saat itu (lihat `validasiNilaiOpsiTerpilih`).
 */
export function validasiOpsiField(params: {
  tipe: TipeField
  opsi: Pick<OpsiField, 'value' | 'aktif'>[]
  /**
   * `optionSourceType` dari `form_fields`. Kalau terisi, opsi dianggap berasal
   * dari sumber dinamis dan kewajiban punya opsi statis dilewati.
   */
  sumberOpsiDinamis?: string | null
}): HasilValidasi {
  const { tipe, opsi, sumberOpsiDinamis } = params
  if (!TIPE_BUTUH_OPSI.includes(tipe)) return lolos
  if (sumberOpsiDinamis) return lolos

  const aktif = opsi.filter((o) => o.aktif !== false)
  if (aktif.length === 0) {
    return gagal(
      'OPSI_KOSONG',
      `Field bertipe ${tipe} wajib punya minimal satu opsi jawaban.`,
    )
  }

  const nilai = aktif.map((o) => o.value.trim())
  if (nilai.some((v) => v === '')) {
    return gagal('OPSI_KOSONG', 'Nilai opsi tidak boleh kosong.')
  }
  if (new Set(nilai).size !== nilai.length) {
    return gagal('OPSI_KOSONG', 'Ada opsi jawaban dengan nilai yang sama.')
  }
  return lolos
}

/**
 * Bentuk field yang diperiksa `validasiFieldPenuh`. Hanya bagian yang perlu
 * validity; bagian lain (urutan, wajib, section) tidak punya aturan bentuk.
 */
export interface FieldDefinisi {
  nama: string
  label?: string | null
  tipe: TipeField
  optionSourceType?: string | null
  optionSourceKey?: string | null
  jumlahKolom?: number | null
  opsi?: readonly Pick<OpsiField, 'value' | 'aktif'>[]
  /** true = field dihapus, jadi tidak diperiksa. */
  hapus?: boolean
  /**
   * true = field bawaan form sistem, jadi bentuknya mengikuti aturan form asalnya
   * dan bukan aturan editor.
   *
   * Field bawaan form kunjungan rumah tidak cocok dengan beberapa aturan umum:
   * namanya mengandung huruf besar (`tglPengumpulan`, `namaKK`), checkbox-nya
   * tidak punya baris opsi karena pilihannya diturunkan dari id field, dan field
   * penyimpan datanya bertipe `group` tanpa jumlah kolom. Semuanya itu sudah
   * tersimpan dan tidak bisa diubah admin, sehingga memaksakan aturan editor
   * hanya membuat draft form itu tidak bisa disimpan sama sekali.
   *
   * Yang tetap dijaga untuk field bawaan: teks pertanyaan harus ada dan nama
   * harus unik di sectionnya. Field yang baru ditambahkan admin bukan field
   * bawaan dan tetap diperiksa penuh.
   */
  fieldBawaan?: boolean
}

/**
 * Sumber pilihan jawaban dari data yang sudah ada.
 *
 * Field boleh menunjuk sumber (mis. daftar agama) lewat
 * `optionSourceType` + `optionSourceKey`, atau menyimpan pilihannya sendiri di
 * `opsi` — bukan keduanya. `sumberOpsiDinamis` dan `opsi` yang keduanya terisi
 * berarti konfigurasi ambigu: saat render salah satunya yang dipakai, jadi yang
 * kelihatan benar sementara yang tersimpan berbeda.
 */
export function validasiSumberOpsi(params: {
  tipe: TipeField
  opsi: readonly Pick<OpsiField, 'value'>[]
  optionSourceType?: string | null
  optionSourceKey?: string | null
}): HasilValidasi {
  const { tipe, opsi, optionSourceType } = params
  if (!optionSourceType) return lolos

  // Prefix `bucket=` dipakai Form Kunjungan Rumah untuk menyimpan tata letak
  // panel (lihat parseBucket di src/lib/server/kunjungan-rumah.server.ts). Kolomnya sama dengan
  // option_source_key, jadi builder tidak boleh pernah mengirim nilai itu.
  if (
    optionSourceType.startsWith('bucket=') ||
    (params.optionSourceKey ?? '').startsWith('bucket=')
  ) {
    return gagal(
      'SUMBER_OPSI_TIDAK_DIKENAL',
      'Sumber pilihan "bucket" milik Form Kunjungan Rumah, bukan pilihan jawaban form.',
    )
  }

  const source = cariSumber(optionSourceType, params.optionSourceKey ?? null)
  if (!source) {
    return gagal(
      'SUMBER_OPSI_TIDAK_DIKENAL',
      `Sumber pilihan "${optionSourceType}" tidak dikenali. Pilih salah satu sumber yang tersedia di pengaturan field.`,
    )
  }

  // `suggest` untuk field teks: daftar sarannya justru hidup di `opsi`, jadi
  // opsi terisi itu wajib dan bukan konflik.
  if (optionSourceType === SUMBER_SUGGEST) {
    if (!source.tipeField?.includes(tipe)) {
      return gagal(
        'SUMBER_OPSI_TIPE_SALAH',
        `Daftar saran hanya bisa dipakai pada field ${source.tipeField?.join(', ') ?? 'teks'}.`,
      )
    }
    return lolos
  }

  // `cari_warga` juga khusus field teks: hasilnya dropdown yang diisi sambil
  // mengetik, bukan daftar jawaban. Opsi statis yang terisi di sini akan
  // ditolak dengan pesan "pilihan jawaban manual harus dikosongkan" di bawah,
  // sama seperti sumber lain — jadi baris `opsi` tidak perlu diperiksa ulang.
  if (optionSourceType === SUMBER_CARI_WARGA) {
    if (!source.tipeField?.includes(tipe)) {
      return gagal(
        'SUMBER_OPSI_TIPE_SALAH',
        `Pencarian warga hanya bisa dipakai pada field ${source.tipeField?.join(', ') ?? 'teks'}.`,
      )
    }
    if (opsi.some((o) => o.value.trim() !== '')) {
      return gagal(
        'SUMBER_OPSI_TIDAK_DIKENAL',
        `Field ini memakai "${source.label}", jadi pilihan jawaban manual harus dikosongkan.`,
      )
    }
    return lolos
  }

  if (!TIPE_BUTUH_OPSI.includes(tipe)) {
    return gagal(
      'SUMBER_OPSI_TIPE_SALAH',
      `Sumber pilihan hanya bisa dipakai pada field select, radio, atau checkbox. Field ini bertipe ${tipe}.`,
    )
  }

  if (opsi.some((o) => o.value.trim() !== '')) {
    return gagal(
      'SUMBER_OPSI_TIDAK_DIKENAL',
      `Field ini memakai sumber "${source.label}", jadi pilihan jawaban manual harus dikosongkan.`,
    )
  }

  return lolos
}

/** `form_fields.nama` varchar(100), dipanggil kode saat menyimpan jawaban. */
const POLA_NAMA_FIELD = /^[a-z0-9_]{1,100}$/

/** Panjang `form_fields.label` (varchar 255). */
const PANJANG_LABEL_FIELD = 255

/**
 * Teks pertanyaan field. Dipisah dari `validasiNamaField` supaya field yang
 * namanya tidak perlu diperiksa ulang (lihat `bolehLanggarPola`) tetap
 * wajib punya teks yang bisa dibaca petugas.
 */
function validasiLabelField(label: string | null | undefined): HasilValidasi {
  const labelBersih = (label ?? '').trim()
  if (labelBersih === '') {
    return gagal('NAMA_FIELD_TIDAK_VALID', 'Teks pertanyaan field wajib diisi.')
  }
  if (labelBersih.length > PANJANG_LABEL_FIELD) {
    return gagal(
      'NAMA_FIELD_TIDAK_VALID',
      `Teks pertanyaan field maksimal ${PANJANG_LABEL_FIELD} karakter.`,
    )
  }
  return lolos
}

/**
 * Nama field = identifier teknis yang dipanggil kode, jadi bentuknya dikunci:
 * huruf kecil, angka, garis bawah. Tanpa ini nama seperti "Nama Lengkap" atau
 * "nama field" akan tersimpan lalu gagal saat kode menyimpan jawaban.
 */
export function validasiNamaField(params: {
  nama: string
  label?: string | null
}): HasilValidasi {
  const namaBersih = params.nama.trim()
  if (!POLA_NAMA_FIELD.test(namaBersih)) {
    return gagal(
      'NAMA_FIELD_TIDAK_VALID',
      'Nama field hanya boleh huruf kecil, angka, dan garis bawah, maksimal 100 karakter.',
    )
  }

  return validasiLabelField(params.label)
}

/**
 * Periksa seluruh daftar field satu section sekaligus, sebelum ada query.
 *
 * Dua hal yang tidak bisa dijamin database dan dipegang di sini: nama unik di
 * dalam satu section (petugas bisa saja mengirim dua field dengan nama sama
 * sekaligus), dan `jumlahKolom` yang hanya sah untuk tipe `group` — kolomnya
 * INTEGER nullable, jadi database menerima `jumlahKolom` di field teks tanpa
 * protes.
 *
 * Field bertipe `hapus` dilewati: field itu memang tidak akan disimpan.
 *
 * `normalisasiNama` untuk form yang menyimpan nama field ber-namespace. Database
 * menyimpan `<section>::<id>` untuk form kunjungan rumah, dan `::` tidak lolos
 * pola nama di atas. Daripada melonggarkan pola itu untuk semua form, nama yang
 * divalidasi bisa diganti bentuknya lebih dulu — bentuk yang tersimpan di
 * database ditentukan pemanggil.
 */
export function validasiFieldPenuh(params: {
  fields: readonly FieldDefinisi[]
  normalisasiNama?: (nama: string) => string
}): HasilValidasi {
  const namaPemakai = new Map<string, number>()

  for (const [i, field] of params.fields.entries()) {
    if (field.hapus === true) continue

    const posisi = `Field ke-${i + 1}`
    // Bentuk yang divalidasi boleh berbeda dari yang akan disimpan.
    const namaDicek = params.normalisasiNama
      ? params.normalisasiNama(field.nama)
      : field.nama
    if (field.fieldBawaan) {
      // Field bawaan: cukup teks pertanyaan dan nama unik. Bentuk lainnya
      // mengikuti aturan form asal, bukan aturan editor.
      const label = validasiLabelField(field.label)
      if (!label.ok) {
        return gagal(label.kode, `${posisi}: ${label.pesan}`)
      }
    } else {
      const nama = validasiNamaField({ nama: namaDicek, label: field.label })
      if (!nama.ok) {
        return gagal(nama.kode, `${posisi}: ${nama.pesan}`)
      }
    }

    const namaBersih = namaDicek.trim()
    const sudah = namaPemakai.get(namaBersih)
    if (sudah !== undefined) {
      return gagal(
        'NAMA_FIELD_BENTARAK',
        `${posisi} memakai nama "${namaBersih}" yang sudah dipakai field ke-${sudah}.`,
      )
    }
    namaPemakai.set(namaBersih, i + 1)

    if (field.fieldBawaan) continue

    if (field.tipe === 'group') {
      const jumlah = field.jumlahKolom
      if (
        jumlah === null ||
        jumlah === undefined ||
        !Number.isInteger(jumlah) ||
        jumlah < 1
      ) {
        return gagal(
          'KOLOM_GROUP_KOSONG',
          `${posisi} bertipe group wajib punya jumlah kolom minimal satu.`,
        )
      }
    } else if (field.jumlahKolom !== null && field.jumlahKolom !== undefined) {
      return gagal(
        'KOLOM_GROUP_KOSONG',
        `${posisi} bukan group, jadi jumlah kolom harus dikosongkan.`,
      )
    }

    const sumberOpsi = validasiSumberOpsi({
      tipe: field.tipe,
      opsi: [...(field.opsi ?? [])],
      optionSourceType: field.optionSourceType ?? null,
      optionSourceKey: field.optionSourceKey ?? null,
    })
    if (!sumberOpsi.ok) {
      return gagal(sumberOpsi.kode, `${posisi}: ${sumberOpsi.pesan}`)
    }

    if (TIPE_BUTUH_OPSI.includes(field.tipe)) {
      const opsi = validasiOpsiField({
        tipe: field.tipe,
        opsi: [...(field.opsi ?? [])],
        sumberOpsiDinamis: field.optionSourceType,
      })
      if (!opsi.ok) {
        return gagal('OPSI_FIELD_KOSONG', `${posisi}: ${opsi.pesan}`)
      }
    }
  }

  return lolos
}

/**
 * Pastikan nilai yang dikirim benar-benar salah satu opsi yang berlaku.
 *
 * Dipakai untuk select/radio/checkbox, termasuk yang sumbernya dinamis. Tanpa
 * cek ini, petugas bisa mengirim nilai apa saja lewat request yang dimanipulasi
 * dan nilai itu akan tersimpan di `survey_entries.value`.
 *
 * Opsi dinamis harus sudah di-resolve di server sebelum memanggil ini; fungsi ini
 * tidak menyentuh database supaya tetap murni dan bisa diuji.
 */
export function validasiNilaiOpsiTerpilih(params: {
  tipe: TipeField
  /** Nilai dari payload, boleh string atau array string (checkbox). */
  nilai: unknown
  opsi: Pick<OpsiField, 'value' | 'aktif'>[]
}): HasilValidasi {
  const { tipe, nilai, opsi } = params
  if (!TIPE_BUTUH_OPSI.includes(tipe)) return lolos

  const boleh = new Set(
    opsi
      .filter((o) => o.aktif !== false)
      .map((o) => o.value.trim())
      .filter((v) => v !== ''),
  )

  const kirim = Array.isArray(nilai) ? nilai : [nilai]
  // Checkbox yang tidak dicentang mengirim array kosong; itu sah, bukan error.
  if (kirim.length === 0) return lolos

  for (const v of kirim) {
    if (typeof v !== 'string' || !boleh.has(v.trim())) {
      return gagal(
        'OPSI_TIDAK_VALID',
        'Pilihan jawaban tidak ada di daftar yang tersedia.',
      )
    }
  }
  return lolos
}

/** Versi yang sudah published atau archived tidak boleh diedit strukturnya. */
export function validasiEdisiVersi(status: string | null): HasilValidasi {
  if (status === null) {
    return gagal('VERSI_TIDAK_ADA', 'Form versi tidak ditemukan.')
  }
  if (status === 'published') {
    return gagal(
      'VERSI_SUDAH_TERBIT',
      'Versi ini sudah diterbitkan dan tidak bisa diedit. Buat versi baru untuk mengubah struktur form.',
    )
  }
  if (status === 'archived') {
    return gagal(
      'VERSI_BUKAN_DRAFT',
      'Versi ini sudah diarsipkan dan tidak bisa diedit.',
    )
  }
  if (status !== 'draft') {
    return gagal('VERSI_BUKAN_DRAFT', `Status versi tidak dikenal: ${status}.`)
  }
  return lolos
}

/** Hanya draft yang boleh diterbitkan, dan tidak boleh dua kali. */
export function validasiTerbitkanVersi(status: string | null): HasilValidasi {
  if (status === null) {
    return gagal('VERSI_TIDAK_ADA', 'Form versi tidak ditemukan.')
  }
  if (status === 'published') {
    return gagal('VERSI_SUDAH_TERBIT', 'Versi ini sudah diterbitkan.')
  }
  if (status !== 'draft') {
    return gagal(
      'VERSI_BUKAN_DRAFT',
      'Hanya versi berstatus draft yang bisa diterbitkan.',
    )
  }
  return lolos
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/
const POLA_WAKTU = /^([01]\d|2[0-3]):[0-5]\d$/

function tanggalNyata(nilai: string): boolean {
  if (!POLA_TANGGAL.test(nilai)) return false
  const bagian = nilai.split('-').map(Number)
  const y = bagian[0]
  const m = bagian[1]
  const d = bagian[2]
  if (y === undefined || m === undefined || d === undefined) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

/**
 * Bentuk jawaban dicek per tipe supaya data sampah tidak masuk. Kolom `value`
 * bertipe jsonb, jadi tanpa ini database menerima apa saja dan rekap rusak diam-diam.
 *
 * Field `image` dan `file` tidak divalidasi di sini: lampirannya belum
 * didukung, jadi belum punya kolom di database.
 *
 * `opsi` undefined berarti pemanggil tidak memuat daftar opsi, dan pengecekan
 * keanggotaan opsi dilewati. `opsi` yang ada tapi kosong atau seluruhnya nonaktif
 * tetap ditegakkan: field tanpa opsi aktif tidak boleh menerima jawaban apa pun.
 */
export function validasiNilaiField(params: {
  tipe: TipeField
  value: unknown
  opsi?: readonly Pick<OpsiField, 'value' | 'aktif'>[]
}): HasilValidasi {
  const { tipe, value, opsi } = params

  if (value === null || value === undefined || value === '') return lolos

  const opsiDiberikan = opsi !== undefined
  const nilaiAktif =
    opsi?.filter((o) => o.aktif !== false).map((o) => o.value) ?? []

  switch (tipe) {
    case 'text':
    case 'textarea':
      if (typeof value !== 'string') {
        return gagal('NILAI_TIDAK_COCOK', `Field ${tipe} harus diisi teks.`)
      }
      return lolos

    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return gagal('NILAI_TIDAK_COCOK', 'Field number harus diisi angka.')
      }
      return lolos

    case 'date':
      if (typeof value !== 'string' || !tanggalNyata(value)) {
        return gagal(
          'NILAI_TIDAK_COCOK',
          'Field date harus diisi tanggal YYYY-MM-DD yang sah.',
        )
      }
      return lolos

    case 'time':
      if (typeof value !== 'string' || !POLA_WAKTU.test(value)) {
        return gagal(
          'NILAI_TIDAK_COCOK',
          'Field time harus diisi waktu HH:MM (24 jam).',
        )
      }
      return lolos

    case 'select':
    case 'radio': {
      if (typeof value !== 'string') {
        return gagal(
          'NILAI_TIDAK_COCOK',
          `Field ${tipe} harus diisi satu nilai teks.`,
        )
      }
      if (opsiDiberikan && !nilaiAktif.includes(value)) {
        return gagal(
          'NILAI_TIDAK_COCOK',
          'Jawaban tidak ada di daftar opsi field ini.',
        )
      }
      return lolos
    }

    case 'checkbox': {
      if (!Array.isArray(value)) {
        return gagal(
          'NILAI_TIDAK_COCOK',
          'Field checkbox harus diisi daftar pilihan.',
        )
      }
      if (!value.every((v) => typeof v === 'string')) {
        return gagal(
          'NILAI_TIDAK_COCOK',
          'Field checkbox harus diisi daftar teks.',
        )
      }
      if (opsiDiberikan) {
        const diLuar = value.filter((v) => !nilaiAktif.includes(v))
        if (diLuar.length > 0) {
          return gagal(
            'NILAI_TIDAK_COCOK',
            `Jawaban di luar opsi field ini: ${diLuar.join(', ')}.`,
          )
        }
      }
      return lolos
    }

    case 'image':
    case 'file':
      return lolos

    case 'group':
      return validasiNilaiGroup({ value })
  }
}

/**
 * NIK 16 digit. Tidak ikut divalidasi ulang di DB karena NIK adalah primary key
 * varchar(16) — cek ini cuma menangkap salah ketik di form_isian.
 */
export function validasiNik(nik: string): HasilValidasi {
  if (!isValidNik(nik)) {
    return gagal('NIK_TIDAK_VALID', 'NIK harus 16 digit angka.')
  }
  return lolos
}

/**
 * Ringkasan isi satu versi draft, dihitung sebelum dihapus.
 *
 * Dipakai dialog konfirmasi supaya admin melihat berapa banyak yang hilang,
 * bukan sekadar menekan tombol dengan angka yang tidak jelas.
 */
export interface RingkasanHapusDraft {
  /** Baris `surveys` yang menunjuk versi ini. */
  jumlahSubmit: number
  /** Baris `form_fields` milik versi ini. */
  jumlahField: number
  /** Baris `form_sections` milik versi ini. */
  jumlahSection: number
}

/**
 * Aturan menghapus satu versi draft.
 *
 * Empat lapis, dari yang paling halus:
 *   1. Hanya versi `draft` yang boleh dihapus. Versi `published` adalah form
 *      yang sedang dipakai petugas; `archived` adalah bukti form apa yang pernah
 *      tayang. Keduanya tidak hilang karena satu klik di editor.
 *   2. Draft form bawaan sistem (`forms.kode` terisi) tidak bisa dihapus.
 *      Form kunjungan rumah punya struktur yang dipetakan balik ke UI kader
 *      lewat nama section dan nama field (lihat `kode-bawaan.ts`), jadi draft
 *      itu adalah satu-satunya tempat admin menulis perubahan
 *      sekaligus satu-satunya salinan struktur itu. Menghapus draft terakhir
 *      membuat form tidak bisa dibangun ulang dengan bentuk yang benar.
 *   3. Draft yang sudah punya isian tidak boleh dihapus. `surveys.formVersionId`
 *      tidak meng-cascade, jadi penghapusan akan ditolak Postgres dengan
 *      pelanggaran FK yang tidak berguna untuk petugas.
 *   4. Versi draft terakhir sebuah form tidak boleh dihapus, karena form tanpa
 *      versi tidak punya editor sama sekali. Admin membuat draft baru dari
 *      tombol "Draft Berikutnya" kalau memang ingin mulai dari nol.
 */
export function validasiHapusDraftVersi(params: {
  status: string | null
  /** `forms.kode` dari form pemilik versi ini. */
  kodeForm: string | null
  jumlahVersi: number
  ringkasan: RingkasanHapusDraft
}): HasilValidasi {
  const { status, kodeForm, jumlahVersi, ringkasan } = params

  if (status === null) {
    return gagal('VERSI_TIDAK_ADA', 'Form versi tidak ditemukan.')
  }
  if (status !== 'draft') {
    return gagal(
      'VERSI_BUKAN_DRAFT',
      status === 'published'
        ? 'Versi ini sudah diterbitkan dan tidak bisa dihapus. Buat draft baru untuk mengubah form.'
        : 'Versi ini sudah diarsipkan dan tidak bisa dihapus.',
    )
  }

  if (kodeForm) {
    return gagal(
      'DRAFT_BAWAAN_TERKUNCI',
      'Draft form bawaan sistem tidak bisa dihapus. Struktur form ini dipetakan ke form kader, jadi draftnya harus tetap ada untuk bisa dibangun ulang.',
    )
  }

  if (ringkasan.jumlahSubmit > 0) {
    return gagal(
      'FORM_PUNYA_ISIAN',
      `Draft ini sudah punya ${ringkasan.jumlahSubmit} isian. Hapus isiannya dulu lewat menu isian form, atau jangan hapus draft ini.`,
    )
  }

  if (jumlahVersi <= 1) {
    return gagal(
      'VERSI_HANYA_SATU',
      'Draft ini satu-satunya versi form ini. Menghapusnya membuat form tidak bisa disunting lagi — buat draft baru dari nol kalau memang ingin.',
    )
  }

  return lolos
}

/**
 * Ringkasan isi satu form, dihitung sebelum dihapus.
 *
 * Dipakai untuk dua hal: menentukan apakah form boleh dihapus tanpa
 * konfirmasi tambahan, dan memberi tahu admin persis berapa banyak data yang
 * akan hilang. Tanpa ini, `forms.nama` unique masih_memberi tahu bahwa ada
 * sesuatu yang tidak beres; angka di sini yang membuatnya bisa dibaca manusia.
 */
export interface RingkasanHapusForm {
  jumlahVersi: number
  /** Baris `surveys` milik seluruh versi form ini. */
  jumlahSubmit: number
  /** Baris `survey_entries` dari submit-submit itu. */
  jumlahJawaban: number
  /** NIK berbeda yang ikut tercatat pada submit-submit itu. */
  jumlahWarga: number
  /** Tanggal isian terakhir, `YYYY-MM-DD`; null kalau belum pernah diisi. */
  tanggalTerakhir: string | null
}

/**
 * Aturan menghapus satu form.
 *
 * Tiga lapis, dari yang halus:
 *   1. Form bawaan sistem (`forms.kode` terisi) tidak pernah bisa dihapus.
 *   2. Form yang sudah punya isian tidak bisa dihapus dengan cara biasa —
 *     foreign key `surveys.formVersionId` tidak meng-cascade, jadi penghapusan
 *     akan ditolak Postgres dengan pesan yang tidak berguna. Petugas diminta
 *     memakai `hapusPermanent`, yang berarti isian ikut hilang.
 *   3. Penghapusan permanen harus dikonfirmasi dengan mengetik nama form persis,
 *      supaya tidak ada yang terhapus karena salah klik.
 *
 * Perbandingan nama sengaja memakai `trim()` tapi TIDAK case-insensitive: nama
 * form apa adanya harus diketik ulang, supaya konfirmasi terasa benar-benar
 * disengaja.
 */
export function validasiHapusForm(params: {
  nama: string
  kode: string | null | undefined
  ringkasan: RingkasanHapusForm
  hapusPermanent?: boolean
  konfirmasiNama?: string | null
}): HasilValidasi {
  const { nama, kode, ringkasan, hapusPermanent } = params

  if (kode) {
    return gagal('FORM_BAWAAN', 'Form bawaan sistem tidak bisa dihapus.')
  }

  if (ringkasan.jumlahSubmit > 0 && !hapusPermanent) {
    return gagal(
      'FORM_PUNYA_ISIAN',
      `Form ini sudah punya ${ringkasan.jumlahSubmit} isian (${ringkasan.jumlahJawaban} jawaban) dari ` +
        `${ringkasan.jumlahVersi} versi. Hapus permanen akan menghapusnya juga dan tidak bisa dibatalkan.`,
    )
  }

  // Konfirmasi nama hanya diminta kalau benar-benar ada isian yang hilang.
  // Pemanggil boleh selalu mengirim `hapusPermanent: true`, jadi tanpa syarat
  // jumlahSubmit form kosong akan ikut tertolak.
  if (
    hapusPermanent &&
    ringkasan.jumlahSubmit > 0 &&
    (params.konfirmasiNama ?? '').trim() !== nama
  ) {
    return gagal(
      'KONFIRMASI_NAMA_SALAH',
      `Ketik nama form persis ("${nama}") untuk melanjutkan penghapusan.`,
    )
  }

  return lolos
}
