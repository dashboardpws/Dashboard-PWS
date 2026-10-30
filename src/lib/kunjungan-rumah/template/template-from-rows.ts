import { HASIL_KUNJUNGAN_RUMAH } from '@/lib/constants'
import { KUNJUNGAN_RUMAH_TEMPLATE_VERSION } from './kunjungan-rumah-templates'
import type {
  KunjunganRumahFieldKind,
  KunjunganRumahSasaranTemplate,
  KunjunganRumahSection,
  KunjunganRumahTemplateField,
  KunjunganRumahTemplates,
} from './kunjungan-rumah-templates'
import { SASARAN_DEFS, SASARAN_KEYS } from './kunjungan-rumah-form'
import type { SasaranKey } from './kunjungan-rumah-form'

/**
 * `forms.nama` bawaan untuk form kunjungan rumah.
 *
 * Hanya nilai awal: begitu form ter-seed, yang dicari aplikasi adalah
 * `forms.kode` (lihat `KODE_FORM_BAWAAN` dan `getKunjunganRumahForm()`), bukan
 * nama ini. Jadi admin bebas mengganti nama form lewat Form Builder tanpa
 * memutus form kader. Seeder memakai konstanta ini supaya nama bawaannya tidak
 * menyimpang dari kode.
 */
export const FORM_KUNJUNGAN_RUMAH = 'Form Kunjungan Rumah'

/**
 * Pemisah antara nama section dan nama field pada `form_fields.nama`.
 *
 * Template lokal memakai ulang id field antar section — `nama`, `nik`, dan
 * `tglLahir` muncul di section `anggota`, `masalah`, dan hampir setiap sasaran,
 * jadi 353 field hanya punya 220 id unik. Tapi
 * `form_fields_form_version_nama_key` mewajibkan `nama` unik per versi form.
 *
 * Seeder karena itu menyimpan `<section>::<id>`, dan pembaca baris di
 * `src/lib/server/kunjungan-rumah.server.ts` membongkar prefix-nya lagi sebelum meneruskan ke
 * `templateFromRows()` di file ini. Kedua sisi harus diubah bersamaan;
 * `pnpm db:check-parity` adalah penjaganya.
 */
export const PEMBATAS_NAMA_FIELD = '::'

/** Nama field unik per versi form, dengan section sebagai namespace. */
export function namaFieldUnik(sectionNama: string, fieldId: string): string {
  return `${sectionNama}${PEMBATAS_NAMA_FIELD}${fieldId}`
}

/** Bucket di DB dipetakan ke section UI dengan prefix `sasaran:`. */
const BUCKET_TO_SECTION: Record<string, KunjunganRumahSection> = {
  identitas: 'sasaran:identitas',
  kolom: 'sasaran:kolom',
  bools: 'sasaran:bools',
  baha: 'sasaran:baha',
}

const SasaranKeys = new Set<string>(SASARAN_KEYS)

/** Section non-sasaran: nama section di DB sudah sama dengan section di UI. */
const PLAIN_SECTIONS = [
  'keluargaInfo',
  'anggota',
  'sanitasi',
  'masalah',
] as const
type PlainSection = (typeof PLAIN_SECTIONS)[number]

/** Bentuk baris yang dikirim server fn. Sudah diratakan supaya aman lewat RPC. */
export interface TemplateQuestionRow {
  fieldId?: string
  sectionId?: string
  kode: string
  pertanyaan: string
  tipe: string
  bucket: string | null
  hint: string | null
  wajib: boolean
  urutan: number
  /** Nonaktif = sengaja disembunyikan dari form kader. Bukan berarti dihapus. */
  aktif: boolean
  opsi: string[]
}

export interface KunjunganRumahTemplateRows {
  /** ID versi yang menjadi sumber definisi dan aturan runtime. */
  formVersionId: string
  /**
   * Nomor versi definisi di database (`form_versions.version`).
   *
   * Hanya untuk ditampilkan, bukan untuk menilai kecocokan: nomor itu
   * naik setiap kali admin menerbitkan revisi baru lewat Form Builder, sedangkan
   * bentuk template di kode tetap sama.
   */
  versiDefinisi: number
  questions: Record<string, TemplateQuestionRow[]>
}

function toField(
  row: TemplateQuestionRow,
  section: KunjunganRumahSection,
  order: number,
  sasaranKey?: SasaranKey,
): KunjunganRumahTemplateField {
  return {
    id: row.kode,
    ...(row.fieldId ? { runtimeId: row.fieldId } : {}),
    ...(row.sectionId ? { runtimeSectionId: row.sectionId } : {}),
    label: row.pertanyaan,
    kind: row.tipe as KunjunganRumahFieldKind,
    section,
    ...(sasaranKey ? { sasaranKey } : {}),
    required: row.wajib,
    active: row.aktif,
    order,
    ...(row.opsi.length > 0 ? { options: row.opsi } : {}),
    ...(row.hint ? { hint: row.hint } : {}),
  }
}

/**
 * Bangun `KunjunganRumahTemplates` dari baris database.
 *
 * Yang diambil dari DB: section, kode, label, tipe, opsi select, hint, bucket layout,
 * urutan, flag wajib, dan flag aktif. Yang tetap dari kode: `version`, `hasilOpsi`,
 * `prioritasDefault`, dan `conditionals` — tiga hal itu masih konstanta TS sesuai
 * keputusan "definisi saja dari DB", dan `KunjunganRumahTemplates.version` bertipe
 * literal jadi tidak bisa diambil dari kolom.
 *
 * Baris `tipe: "group"` dilewati: grup hanya untuk grouping struktural (blok K1, KF1, dst)
 * dan tidak pernah dirender sebagai field. Karena grup ikut menggeser `urutan` di DB,
 * `order` dihitung ulang dari posisi setelah grup dibuang — itu yang membuatnya sama
 * dengan template lokal.
 *
 * `rows.versiDefinisi` sengaja tidak diperiksa. Nomor itu naik setiap kali admin
 * menerbitkan revisi definisi lewat Form Builder, dan publishing itu memang
 * perubahan yang diinginkan. Menyamakan nomor revisinya dengan konstanta template
 * akan menggagalkan seluruh form kader setiap kali definisi diubah.
 */
export function templateFromRows(
  rows: KunjunganRumahTemplateRows,
): KunjunganRumahTemplates {
  // `version` dan `hasilOpsi` sengaja dari kode, bukan dari rows — lihat catatan fungsi.
  const plain: Record<PlainSection, KunjunganRumahTemplateField[]> = {
    keluargaInfo: [],
    anggota: [],
    sanitasi: [],
    masalah: [],
  }

  const sasaran = {} as Record<SasaranKey, KunjunganRumahSasaranTemplate>

  for (const key of SASARAN_KEYS) {
    const def = SASARAN_DEFS.find((d) => d.key === key)
    if (!def) throw new Error(`Sasaran "${key}" tidak ada di SASARAN_DEFS`)
    sasaran[key] = {
      label: def.label,
      fields: [],
      prioritasDefault: [...def.prioritasDefault],
    }
  }

  for (const sectionNama of Object.keys(rows.questions)) {
    const list = rows.questions[sectionNama] ?? []
    const leaves = list
      .filter((row) => row.tipe !== 'group')
      .sort((a, b) => a.urutan - b.urutan)

    if (SasaranKeys.has(sectionNama)) {
      const key = sectionNama as SasaranKey
      // `sasaran` sudah diisi untuk setiap SASARAN_KEYS di atas, jadi entry ini selalu ada.
      const target = sasaran[key]

      target.fields = leaves.map((row, index) => {
        const section = row.bucket ? BUCKET_TO_SECTION[row.bucket] : undefined
        if (!section) {
          throw new Error(
            `Question "${row.kode}" pada section ${sectionNama} punya bucket tidak valid: ${row.bucket}`,
          )
        }
        return toField(row, section, index, key)
      })
      continue
    }

    if ((PLAIN_SECTIONS as readonly string[]).includes(sectionNama)) {
      plain[sectionNama as PlainSection] = leaves.map((row, index) =>
        toField(row, sectionNama as PlainSection, index),
      )
      continue
    }

    // Section yang tidak dikenal (mis. `hasil`, yang memang tanpa question) diabaikan
    // diam-diam supaya section tambahan tidak menggagalkan seluruh form.
  }

  return {
    version: KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
    keluargaInfo: plain.keluargaInfo,
    anggota: plain.anggota,
    sanitasi: plain.sanitasi,
    sasaran,
    masalah: plain.masalah,
    hasilOpsi: [...HASIL_KUNJUNGAN_RUMAH],
  }
}
