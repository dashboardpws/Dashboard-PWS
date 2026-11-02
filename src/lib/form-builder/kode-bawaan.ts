/**
 * Penjaga struktur form bawaan saat Form Builder menyimpan draft.
 *
 * Form Kunjungan Rumah bukan form generik: bentuknya dipetakan balik ke UI
 * kader lewat nama section (`keluargaInfo`, `anggota`, `penyimpanan`, dan
 * `SASARAN_KEYS`), lewat prefix `<section>::` pada `form_fields.nama`, dan lewat
 * bucket layout panel sasaran yang menyamar sebagai `option_source_key`. Tidak
 * semua struktur itu terlihat dari sisi editor, jadi builder yang bebas akan
 * bisa menyimpan draft yang membuat form kader gagal render.
 *
 * Modul ini murni (tanpa database) supaya bisa dipakai dua pihak: service
 * `buildFormVersion` untuk menolak, dan editor untuk menonaktifkan kontrol yang
 * memang sudah pasti ditolak. Aturan di sini adalah batas mutlak — UI yang
 * lupa menonaktifkan kontrol hanya jadi tidak ramah, bukan jadi tidak aman.
 */
import { KODE_FORM_BAWAAN } from '@/lib/constants'
import { SASARAN_KEYS } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'
import { PEMBATAS_NAMA_FIELD } from '@/lib/kunjungan-rumah/template/template-from-rows'
import type {
  HasilValidasi,
  TipeField,
} from '@/lib/service/form-builder/validasi'

/**
 * Section bawaan form kunjungan rumah di luar daftar sasaran.
 *
 * `hasil` hanya wadah untuk field hasil/TTD yang dirender widget sendiri; field
 * isiannya memang tidak berasal dari baris `form_fields`.
 */
const SECTION_PLAIN = [
  'keluargaInfo',
  'anggota',
  'sanitasi',
  'masalah',
  'hasil',
] as const

/**
 * Section tempat payload legacy disimpan. Wajib ada: seluruh isian kunjungan
 * rumah ditelusuri lewat field di section ini (lihat `fieldIdRecordLegacy()`),
 * jadi menghapusnya mematikan penyimpanan dan update record.
 */
export const SECTION_PENYIMPANAN = 'penyimpanan'

/** Field penyimpan payload. Satu-satunya field bertipe `group` di form ini. */
export const FIELD_RECORD_LEGACY = 'record_legacy'

/** Nama-nama section yang tidak boleh berubah. */
export const SECTION_TERLINDUNGI: ReadonlySet<string> = new Set<string>([
  ...SECTION_PLAIN,
  SECTION_PENYIMPANAN,
  ...SASARAN_KEYS,
])

/**
 * Bucket layout panel sasaran, disimpan sebagai prefix pada `option_source_key`.
 *
 * Satu kolom varchar dipakai dua hal: opsi dinamis dan penanda bucket.
 * Nilainya harus persis seperti di sini, karena `parseBucket()` di
 * `src/lib/server/kunjungan-rumah.server.ts` memotong berdasarkan prefix `bucket=`.
 */
export const BUCKET_SASARAN: ReadonlySet<string> = new Set([
  'identitas',
  'kolom',
  'bools',
  'baha',
])

export const PREFIX_BUCKET = 'bucket='

export function kunciBucket(bucket: string): string {
  return `${PREFIX_BUCKET}${bucket}`
}

/**
 * Tipe field yang bisa dirender form kader.
 *
 * `KunjunganRumahFieldKind` persis lima jenis ini dan `FieldCell` hanya punya
 * cabang untuk lima itu, jadi tipe lain akan tampil kosong atau gagal disimpan
 * runtime. `group` dikecualikan karena dipakai untuk `record_legacy`.
 */
export const TIPE_KADER: ReadonlySet<string> = new Set([
  'text',
  'number',
  'date',
  'select',
  'checkbox',
])

export interface SectionBawaan {
  id: string | null
  nama: string
  sectionKind?: string | null
}

export interface FieldBawaan {
  id: string | null
  sectionId: string | null
  nama: string
  tipe: TipeField
  optionSourceType: string | null
  optionSourceKey: string | null
}

/**
 * Bentuk draft yang diperiksa satu form bawaan sebelum ditulis.
 *
 * `sectionsLama` dan `fieldsLama` adalah isi versi ini sebelum draft disimpan.
 * Keduanya dipakai untuk menolak rename dan penghapusan: nama section dan nama
 * field adalah kunci yang dibaca form kader, bukan label yang bebas diubah.
 */
export interface DraftBawaan {
  sections: SectionBawaan[]
  fields: FieldBawaan[]
  sectionsLama: { id: string; nama: string }[]
  fieldsLama: {
    id: string
    sectionId: string
    nama: string
    tipe: TipeField
    optionSourceKey: string | null
  }[]
}

/** Nama field tanpa prefix `<section>::`, sama seperti yang dibaca `templateFromRows()`. */
export function namaTanpaPrefix(nama: string): string {
  const found = nama.indexOf(PEMBATAS_NAMA_FIELD)
  return found === -1 ? nama : nama.slice(found + PEMBATAS_NAMA_FIELD.length)
}

/** Nama field di database, dengan section sebagai namespace. */
export function namaDenganPrefix(sectionNama: string, nama: string): string {
  return `${sectionNama}${PEMBATAS_NAMA_FIELD}${nama}`
}

/**
 * Bucket yang boleh dipakai field baru di section sasaran.
 *
 * Field baru harus ikut salah satu bucket: `templateFromRows()` melempar error
 * kalau bucket kosong atau tidak dikenal, jadi field tanpa bucket akan menggagalkan
 * seluruh form, bukan cuma dirinya sendiri.
 */
export function pesanBucketWajibSasaran(): string {
  return `WAJIB. Field di section sasaran harus punya bucket layout (${[...BUCKET_SASARAN].join(', ')}); field tanpa bucket membuat form kader gagal dimuat.`
}

function gagal(pesan: string): HasilValidasi {
  return { ok: false, kode: 'STRUKTUR_BAWAAN_DIKUNCI', pesan }
}

/**
 * Periksa draft form kunjungan rumah sebelum ditulis.
 *
 * Dipanggil lewat {@link aturanForm}, bukan langsung: pemanggil tidak perlu tahu
 * kode form mana yang punya aturan apa.
 */
function validasiKunjunganRumah({
  sections,
  fields,
  sectionsLama,
  fieldsLama,
}: DraftBawaan): HasilValidasi {
  // --- Section: nama bawaan terkunci, section generik baru boleh ditambah ---
  const namaSectionBaru = new Map<string, string>()
  for (const s of sections) {
    const nama = s.nama.trim()
    const lama = s.id ? sectionsLama.find((x) => x.id === s.id) : undefined
    if (!nama) {
      return gagal('Nama section wajib diisi.')
    }
    if (
      !lama &&
      (SECTION_TERLINDUNGI.has(nama) || s.sectionKind !== 'form_generik')
    ) {
      // Section bawaan hanya boleh datang dari definisi yang sudah ada. Kalau
      // id-nya tidak dikenal, draft ini mencoba menyisipkan section bawaan baru
      // atau membawa id dari versi lain.
      return gagal(`Section baru "${nama}" hanya boleh bertipe form_generik.`)
    }
    if (namaSectionBaru.has(nama)) {
      return gagal(`Section "${nama}" muncul lebih dari sekali.`)
    }
    namaSectionBaru.set(nama, s.id ?? '')

    if (lama && lama.nama !== nama) {
      // Rename section generik pun ditolak: nama section adalah namespace kunci
      // isian (`${section}::${fieldId}`) yang sudah tersimpan di record.
      return gagal(
        `Section "${lama.nama}" tidak bisa diubah nama menjadi "${nama}". Nama section form kunjungan rumah dipetakan ke form kader secara langsung.`,
      )
    }
  }

  for (const lama of sectionsLama) {
    // Section generik boleh dihapus; section bawaan tidak, karena renderer
    // mencarinya berdasarkan nama. Menonaktifkan section generik lebih aman:
    // isian lama tetap tersimpan di record.
    if (!SECTION_TERLINDUNGI.has(lama.nama)) continue
    const masihAda = sections.some((s) => s.id === lama.id)
    if (!masihAda) {
      return gagal(
        `Section "${lama.nama}" tidak bisa dihapus. Form kader membacanya berdasarkan nama section ini.`,
      )
    }
  }

  // --- Field: nama terkunci, section terkunci, tipe & bucket terkunci ---
  const fieldsLamaById = new Map(fieldsLama.map((f) => [f.id, f]))
  const sectionIdKeNama = new Map<string, string>()
  for (const s of sections) sectionIdKeNama.set(s.id ?? '', s.nama)

  for (const f of fields) {
    const label = namaTanpaPrefix(f.nama.trim())
    const sectionNama = sectionIdKeNama.get(f.sectionId ?? '') ?? null

    // Field yang sudah ada: nama, section, dan bucket tidak boleh berubah.
    // Dicek lebih dulu supaya pesannya menyebut field yang menentukan,
    // bukan "bucket tidak sah" yang menyesatkan kalau penyebabnya pemindahan.
    if (f.id) {
      const lama = fieldsLamaById.get(f.id)
      if (lama) {
        if (namaTanpaPrefix(lama.nama) !== label) {
          return gagal(
            `Nama field "${lama.nama}" tidak bisa diubah menjadi "${label}". Nama field adalah kunci data isian yang sudah tersimpan.`,
          )
        }
        if (lama.sectionId !== f.sectionId) {
          return gagal(
            `Field "${label}" tidak bisa dipindahkan ke section lain.`,
          )
        }
        if (lama.optionSourceKey !== f.optionSourceKey) {
          return gagal(`Bucket field "${label}" tidak bisa diubah.`)
        }
        // [Iterasi 3 Guard] Kunci tipe field lama agar tidak mengubah tipe data record_legacy
        if (lama.tipe !== f.tipe) {
          return gagal(
            `Tipe field "${label}" (${lama.tipe}) tidak bisa diubah menjadi "${f.tipe}". Perubahan tipe field lama dilarang untuk menjaga integritas data histori.`,
          )
        }
      }
    }

    // Tipe. `group` hanya untuk field penyimpanan.
    if (f.tipe === 'group') {
      const adalahRecordLegacy = label === FIELD_RECORD_LEGACY
      if (!adalahRecordLegacy) {
        return gagal(
          `Field "${label}" bertipe group. Form kunjungan rumah hanya boleh punya satu field group, yaitu penyimpan data kunjungan.`,
        )
      }
    } else if (!TIPE_KADER.has(f.tipe)) {
      return gagal(
        `Field "${label}" bertipe "${f.tipe}". Form kunjungan rumah hanya bisa diisi dengan tipe: ${[...TIPE_KADER].join(', ')}.`,
      )
    }

    // Sumber opsi. Tidak ada sumber dinamis di form ini: opsi field select
    // disimpan sebagai `form_field_options`, bukan dari option source.
    if (f.optionSourceType !== null) {
      return gagal(
        `Field "${label}" tidak boleh memakai sumber pilihan dari data. Pilihan form kunjungan rumah ditulis manual.`,
      )
    }

    // Bucket. Field section sasaran wajib punya bucket yang sah; field section
    // biasa justru tidak boleh punya apa pun di `option_source_key`.
    const diSasaran =
      sectionNama !== null &&
      (SASARAN_KEYS as readonly string[]).includes(sectionNama)
    if (diSasaran) {
      const bucket = f.optionSourceKey?.startsWith(PREFIX_BUCKET)
        ? f.optionSourceKey.slice(PREFIX_BUCKET.length)
        : null
      if (!bucket || !BUCKET_SASARAN.has(bucket)) {
        return gagal(pesanBucketWajibSasaran())
      }
    } else if (f.optionSourceKey !== null && sectionNama !== null) {
      return gagal(
        `Field "${label}" di section "${sectionNama}" tidak boleh punya option source key.`,
      )
    }
  }

  // --- Field penyimpanan tidak boleh hilang ---
  const recordLegacyLama = fieldsLama.filter(
    (f) => namaTanpaPrefix(f.nama) === FIELD_RECORD_LEGACY,
  )
  const recordLegacyBaru = fields.filter(
    (f) => namaTanpaPrefix(f.nama.trim()) === FIELD_RECORD_LEGACY,
  )
  if (recordLegacyLama.length > 0 && recordLegacyBaru.length === 0) {
    return gagal(
      `Field "${SECTION_PENYIMPANAN}${PEMBATAS_NAMA_FIELD}${FIELD_RECORD_LEGACY}" tidak bisa dihapus. Field ini tempat seluruh data kunjungan rumah disimpan.`,
    )
  }

  return { ok: true }
}

/** Ringkasan aturan yang sudah pasti ditolak server, untuk dipakai editor.
 *
 * Tujuannya satu: jangan menawarkan kontrol yang kalau dipakai pasti berakhir
 * dengan build gagal. Penegakan sebenarnya tetap di `validasiDraft` milik tiap
 * form bawaan — UI yang lupa menonaktifkan kontrol hanya jadi tidak ramah, bukan
 * jadi tidak aman.
 *
 * Karena itu sumbernya sama: apa yang ditulis di sini harus persis apa yang
 * diterima `validasiDraft`. Form yang aturannya belum dipetakan balik
 * (kegiatan) mendapat {@link BEBAS_BUTUH_DIEDIT} supaya editor tidak membatasi
 * sesuatu yang sebenarnya boleh diubah.
 */
export interface KunciEditor {
  /** Nama section tidak boleh diubah. */
  namaSection: boolean
  /** Section tidak boleh ditambah, dipindah, atau dihapus. */
  strukturSection: boolean
  /** Sumber pilihan jawaban dari data tidak boleh dipasang. */
  optionSource: boolean
  /** Tipe yang boleh dipilih di palette dan dropdown. null = semua bebas. */
  tipe: ReadonlySet<string> | null
  /** Field dengan nama ini tidak boleh dihapus. */
  namaFieldTidakBolehDihapus: (nama: string) => boolean
}

/** Form tanpa pemetaan balik: seluruh editor dibiarkan apa adanya. */
const BEBAS_BUTUH_DIEDIT: KunciEditor = {
  namaSection: false,
  strukturSection: false,
  optionSource: false,
  tipe: null,
  namaFieldTidakBolehDihapus: () => false,
}

const KUNCI_KUNJUNGAN_RUMAH: KunciEditor = {
  namaSection: true,
  // Section generik baru boleh ditambahkan/diatur strukturnya, tetapi section bawaan tetap dilindungi server
  strukturSection: false,
  optionSource: true,
  tipe: TIPE_KADER,
  namaFieldTidakBolehDihapus: (nama) =>
    namaTanpaPrefix(nama) === FIELD_RECORD_LEGACY,
}

/**
 * Aturan satu form bawaan: apa yang ditolak saat Build, dan apa yang dikunci di
 * editor.
 *
 * Satu tempat untuk menambah form bawaan baru — tinggal satu entri di
 * {@link ATURAN_BAWAAN}, bukan satu cabang di dua fungsi.
 */
export interface AturanFormBawaan {
  /** Tolak draft yang bentuknya akan membuat form ini gagal render. */
  validasiDraft: (draft: DraftBawaan) => HasilValidasi
  /** Bagian editor yang form ini larang. */
  kunciEditor: KunciEditor
}

const ATURAN_BAWAAN: Record<string, AturanFormBawaan> = {
  [KODE_FORM_BAWAAN.kunjunganRumah]: {
    validasiDraft: validasiKunjunganRumah,
    kunciEditor: KUNCI_KUNJUNGAN_RUMAH,
  },
  // Form bawaan berikutnya (kegiatan) belum punya UI sendiri, jadi strukturnya
  // belum dikunci. Tambahkan entri di sini saat kegiatan punya UI sendiri.
}

/**
 * Aturan form bebas: draft apa pun lolos, seluruh editor terbuka.
 *
 * Dipakai untuk form manual (`forms.kode` null) dan untuk kode form bawaan yang
 * belum punya entri di {@link ATURAN_BAWAAN}. Default bebas supaya form yang
 * baru punya UI sendiri tidak terkunci total tanpa disengaja.
 */
const ATURAN_BEBAS: AturanFormBawaan = {
  validasiDraft: () => ({ ok: true }),
  kunciEditor: BEBAS_BUTUH_DIEDIT,
}

/**
 * Aturan untuk satu form, dihitung dari `forms.kode`.
 *
 * Satu-satunya tempat yang perlu diganti kalau ada form bawaan baru. `null`
 * berarti form manual: tidak ada penjaga, editor terbuka penuh.
 */
export function aturanForm(formKode: string | null): AturanFormBawaan {
  if (formKode === null) return ATURAN_BEBAS
  return ATURAN_BAWAAN[formKode] ?? ATURAN_BEBAS
}
