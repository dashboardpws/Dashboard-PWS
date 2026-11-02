import { HASIL_KUNJUNGAN_RUMAH } from '@/lib/constants'
import {
  KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
  aturanVisibilitasWarisan,
  labelSectionBawaan,
  resolveSectionKind,
} from './kunjungan-rumah-templates'
import type {
  KunjunganRumahFieldKind,
  KunjunganRumahLayoutGroup,
  KunjunganRumahSasaranTemplate,
  KunjunganRumahSection,
  KunjunganRumahSectionTemplate,
  KunjunganRumahTemplateField,
  KunjunganRumahTemplates,
  KunjunganRumahVisibilityRule,
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

/** Bentuk baris section yang dikirim server fn. Sudah diratakan supaya aman lewat RPC. */
export interface TemplateSectionRow {
  sectionId?: string
  nama: string
  label: string
  description?: string | null
  urutan: number
  aktif: boolean
  sectionKind?: string | null
  layoutGroups?: KunjunganRumahLayoutGroup[]
}

/** Bentuk baris field yang dikirim server fn. Sudah diratakan supaya aman lewat RPC. */
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
  placeholder?: string | null
  columns?: number | null
  layoutGroup?: string | null
  visibilityRules?: KunjunganRumahVisibilityRule[]
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
  /**
   * Metadata section, termasuk label, urutan, dan peran render.
   *
   * Opsional supaya pemanggil lama (dan test yang cuma membangun baris field)
   * tetap jalan; kalau absen, urutan dan peran disimpulkan dari nama section.
   */
  sections?: TemplateSectionRow[]
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
    options: row.opsi.length > 0 ? row.opsi : undefined,
    hint: row.hint || undefined,
    ...(row.placeholder ? { placeholder: row.placeholder } : {}),
    ...(row.columns != null ? { columns: row.columns } : {}),
    ...(row.layoutGroup ? { layoutGroup: row.layoutGroup } : {}),
    ...(row.visibilityRules ? { visibilityRules: row.visibilityRules } : {}),
  }
}

function sanitizeLayoutGroups(
  groups: KunjunganRumahLayoutGroup[] | undefined,
): KunjunganRumahLayoutGroup[] {
  if (!groups) return []
  return groups
    .filter(
      (g) =>
        typeof g.key === 'string' &&
        !!g.key &&
        typeof g.label === 'string' &&
        typeof g.order === 'number' &&
        Number.isFinite(g.order),
    )
    .map((g) => ({ key: g.key, label: g.label, order: g.order }))
}

/**
 * Bangun `KunjunganRumahTemplates` dari baris database.
 *
 * Yang diambil dari DB: section beserta label/urutan/peran, kode, label, tipe,
 * opsi select, hint, placeholder, kelompok layout, bucket layout, urutan, flag
 * wajib, flag aktif, serta opsi hasil dari field select section hasil.
 * `prioritasDefault` tetap dari kode karena merupakan semantik program, dan
 * `KunjunganRumahTemplates.version` bertipe literal.
 *
 * Section yang tidak dikenal tidak lagi dibuang. Kalau metadata `sectionKind`
 * tidak ada, peran section disimpulkan dari nama bawaan; selain itu menjadi
 * `form_generik` dan dirender oleh renderer generik. Ini yang membuat section
 * tambahan dari Form Builder tampil tanpa perubahan kode.
 *
 * Baris `tipe: "group"` dilewati: grup hanya untuk grouping struktural (blok K1,
 * KF1, dst) dan tidak pernah dirender sebagai field. Karena grup ikut menggeser
 * `urutan` di DB, `order` dihitung ulang dari posisi setelah grup dibuang — itu
 * yang membuatnya sama dengan template lokal.
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
  const plain: Record<string, KunjunganRumahTemplateField[]> = {
    keluargaInfo: [],
    anggota: [],
    sanitasi: [],
    masalah: [],
    hasil: [],
  }

  const sasaran = {} as Record<SasaranKey, KunjunganRumahSasaranTemplate>

  for (const key of SASARAN_KEYS) {
    const def = SASARAN_DEFS.find((d) => d.key === key)
    if (!def) throw new Error(`Sasaran "${key}" tidak ada di SASARAN_DEFS`)
    sasaran[key] = {
      label: def.label,
      fields: [],
      layoutGroups: [],
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

      const def = SASARAN_DEFS.find((sasaranDef) => sasaranDef.key === key)
      const fallbackRules = aturanVisibilitasWarisan(key, def?.conditionals)
      target.fields = leaves.map((row, index) => {
        const section = row.bucket ? BUCKET_TO_SECTION[row.bucket] : undefined
        if (!section) {
          throw new Error(
            `Question "${row.kode}" pada section ${sectionNama} punya bucket tidak valid: ${row.bucket}`,
          )
        }
        const field = toField(row, section, index, key)
        if (!row.visibilityRules?.length) {
          field.visibilityRules = fallbackRules.filter(
            (rule) => rule.targetId === field.id,
          )
        }
        return field
      })
      const meta = rows.sections?.find(
        (section) => section.nama === sectionNama,
      )
      if (meta?.layoutGroups)
        target.layoutGroups = sanitizeLayoutGroups(meta.layoutGroups)
      continue
    }

    if (sectionNama in plain) {
      plain[sectionNama] = leaves.map((row, index) =>
        toField(row, sectionNama, index),
      )
    }
  }

  const sectionMeta = new Map<string, TemplateSectionRow>()
  for (const meta of rows.sections ?? []) {
    if (!sectionMeta.has(meta.nama)) sectionMeta.set(meta.nama, meta)
  }

  let sasaranOrder = Number.POSITIVE_INFINITY
  for (const meta of rows.sections ?? []) {
    if (resolveSectionKind(meta.nama, meta.sectionKind) === 'sasaran') {
      sasaranOrder = Math.min(sasaranOrder, meta.urutan)
    }
  }
  if (!Number.isFinite(sasaranOrder)) sasaranOrder = 3

  const sections: KunjunganRumahSectionTemplate[] = []
  const urutanTerakhir = (rows.sections ?? []).reduce(
    (max, meta) => Math.max(max, meta.urutan),
    -1,
  )
  let urutanFallback = urutanTerakhir + 1

  const pushSection = (meta: TemplateSectionRow): void => {
    const kind = resolveSectionKind(meta.nama, meta.sectionKind)
    if (kind === 'sasaran' || kind === 'penyimpanan') return

    const list = rows.questions[meta.nama] ?? []
    const leaves = list
      .filter((row) => row.tipe !== 'group')
      .sort((a, b) => a.urutan - b.urutan)

    let fields: KunjunganRumahTemplateField[]
    switch (kind) {
      case 'keluarga':
        fields = plain.keluargaInfo ?? []
        break
      case 'anggota':
        fields = plain.anggota ?? []
        break
      case 'sanitasi':
        fields = plain.sanitasi ?? []
        break
      case 'masalah':
        fields = plain.masalah ?? []
        break
      case 'hasil':
        fields = plain.hasil ?? []
        break
      default:
        fields = leaves.map((row, index) => toField(row, meta.nama, index))
    }

    sections.push({
      name: meta.nama,
      label: meta.label || labelSectionBawaan(meta.nama),
      description: meta.description ?? null,
      kind,
      order: meta.urutan,
      active: meta.aktif,
      fields,
      layoutGroups: sanitizeLayoutGroups(meta.layoutGroups),
      ...(meta.sectionId ? { runtimeId: meta.sectionId } : {}),
    })
  }

  for (const meta of rows.sections ?? []) {
    pushSection(meta)
  }

  // Section yang punya baris field tapi tidak punya metadata tetap dirender.
  // Ini menjaga baris lama/manual di Form Builder yang tidak lewat seeder.
  for (const sectionNama of Object.keys(rows.questions)) {
    if (sectionMeta.has(sectionNama)) continue
    if (SasaranKeys.has(sectionNama)) continue
    pushSection({
      nama: sectionNama,
      label: labelSectionBawaan(sectionNama),
      urutan: urutanFallback++,
      aktif: true,
    })
  }

  // Definisi lama (seeder sebelum `hasil` ikut di-seed) tidak punya section
  // hasil. Section itu tidak punya field DB — isinya widget hasil/TTD — jadi
  // tanpa ditambal di sini kartu "Hasil, Prioritas & Tindak Lanjut" hilang
  // seluruhnya. Ditaruh tepat setelah masalah supaya tetap satu kartu.
  if (!sections.some((section) => section.kind === 'hasil')) {
    const masalah = sections.find((section) => section.kind === 'masalah')
    sections.push({
      name: 'hasil',
      label: labelSectionBawaan('hasil'),
      description: null,
      kind: 'hasil',
      order: masalah ? masalah.order + 1 : urutanFallback++,
      active: true,
      fields: [],
      layoutGroups: [],
    })
  }

  sections.sort((a, b) => a.order - b.order)
  const sectionHasil = sections.find((section) => section.kind === 'hasil')
  const fieldHasil = sectionHasil?.fields.find(
    (field) => field.kind === 'select',
  )
  const hasilOpsi = fieldHasil
    ? fieldHasil.active
      ? (fieldHasil.options ?? [])
      : []
    : [...HASIL_KUNJUNGAN_RUMAH]
  const hasilWajib = fieldHasil
    ? fieldHasil.active && fieldHasil.required
    : true

  return {
    version: KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
    keluargaInfo: plain.keluargaInfo ?? [],
    anggota: plain.anggota ?? [],
    sanitasi: plain.sanitasi ?? [],
    sasaran,
    masalah: plain.masalah ?? [],
    sections,
    sasaranOrder,
    hasilOpsi,
    hasilWajib,
  }
}
