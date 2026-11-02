import { HASIL_KUNJUNGAN_RUMAH } from '@/lib/constants'
import { SASARAN_DEFS, SASARAN_KEYS } from './kunjungan-rumah-form'
import type { ConditionalRule, SasaranKey } from './kunjungan-rumah-form'
import type { NilaiJSON } from '@/lib/form-builder/engine/types'

export const KUNJUNGAN_RUMAH_TEMPLATE_VERSION = 17 as const

// ── Tipe ──
export type KunjunganRumahFieldKind =
  'text' | 'number' | 'date' | 'select' | 'checkbox'

/**
 * Section UI. Nama section generik bebas, jadi tipenya string; nilai bawaan
 * tetap didokumentasikan di {@link KunjunganRumahSectionNama}.
 */
export type KunjunganRumahSection = string

export type KunjunganRumahSectionNama =
  | 'keluargaInfo'
  | 'anggota'
  | 'sanitasi'
  | 'sasaran:identitas'
  | 'sasaran:kolom'
  | 'sasaran:bools'
  | 'sasaran:baha'
  | 'masalah'
  | 'hasil'

/**
 * Peran section di form kunjungan rumah.
 *
 * Renderer memilih widget dari nilai ini, bukan dari nama field. Section lama
 * yang belum punya metadata disimpulkan dari nama bawaan (lihat
 * `resolveSectionKind`).
 */
export type KunjunganRumahSectionKind =
  | 'keluarga'
  | 'anggota'
  | 'sanitasi'
  | 'sasaran'
  | 'masalah'
  | 'hasil'
  | 'penyimpanan'
  | 'form_generik'

export const KUNJUNGAN_RUMAH_SECTION_KINDS: readonly KunjunganRumahSectionKind[] =
  [
    'keluarga',
    'anggota',
    'sanitasi',
    'sasaran',
    'masalah',
    'hasil',
    'penyimpanan',
    'form_generik',
  ]

export interface KunjunganRumahLayoutGroup {
  key: string
  label: string
  order: number
}

export interface KunjunganRumahVisibilityRule {
  id: string
  targetType: 'field'
  targetId: string
  triggerFieldId: string
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'kosong' | 'tidak_kosong'
  nilaiAcuan: NilaiJSON
  aktif: boolean
  urutan: number
}

export interface KunjunganRumahTemplateField {
  id: string
  /** ID field database; tidak ada pada definisi fallback lokal. */
  runtimeId?: string
  /** ID section database; dipakai aturan visibilitas runtime. */
  runtimeSectionId?: string
  label: string
  kind: KunjunganRumahFieldKind
  section: KunjunganRumahSection
  sasaranKey?: SasaranKey
  required: boolean
  active: boolean
  order: number
  options?: string[]
  hint?: string
  /** Placeholder dari Form Builder; null/absen = pakai placeholder bawaan. */
  placeholder?: string
  /** Lebar field dalam jumlah kolom grid. */
  columns?: number
  /** Kunci kelompok layout di dalam section. */
  layoutGroup?: string
  visibilityRules?: KunjunganRumahVisibilityRule[]
}

export interface KunjunganRumahSectionTemplate {
  name: string
  label: string
  description: string | null
  kind: KunjunganRumahSectionKind
  order: number
  active: boolean
  fields: KunjunganRumahTemplateField[]
  layoutGroups: KunjunganRumahLayoutGroup[]
  /** ID section database; tidak ada pada definisi fallback lokal. */
  runtimeId?: string
}

export interface KunjunganRumahSasaranTemplate {
  label: string
  fields: KunjunganRumahTemplateField[]
  layoutGroups: KunjunganRumahLayoutGroup[]
  prioritasDefault: string[]
}

/**
 * Kelompok awal agar form yang sudah berjalan tetap punya susunan familiar.
 * Setelah disimpan di schema, renderer hanya membaca metadata ini; field baru
 * bisa memakai kelompok yang sama tanpa menambah aturan pada komponen.
 */
function grupAwalSasaran(key: SasaranKey, fieldId: string): string | undefined {
  if (/^k[1-6](Tempat|Tanggal|Petugas)$/.test(fieldId))
    return 'kunjungan-antenatal'
  if (fieldId.startsWith('edukasiNakes')) return 'edukasi-nakes'
  if (fieldId.startsWith('skriningJiwa')) return 'skrining-jiwa'
  if (fieldId.startsWith('kelasIbu')) return 'kelas-ibu'
  if (
    /^kf[1-4](Tempat|Tanggal|Petugas)$/.test(fieldId) ||
    fieldId === 'vitATanggal'
  )
    return 'nifas'
  if (/^kn[0-3](Tanggal|Tempat|Petugas)$/.test(fieldId)) return 'neonatal'
  if (
    [
      'obatCacingTanggal',
      'vitA6_11Bulan',
      'vitA12Bulan',
      'mtKepatuhan',
    ].includes(fieldId)
  )
    return 'suplementasi'
  if (/^(td|gd)Periksa/.test(fieldId)) return 'pemeriksaan-rutin'
  if (
    ['aksTempat', 'aksTanggal', 'skilasTempat', 'skilasTanggal'].includes(
      fieldId,
    )
  )
    return 'skrining-geriatri'
  if (key === 'tbc' && fieldId === 'kontakEratJenis') return 'kontak-erat'
  return undefined
}

const LABEL_GRUP_SASARAN: Record<string, string> = {
  'kunjungan-antenatal': 'Pemeriksaan kehamilan (K1–K6)',
  'edukasi-nakes': 'Edukasi kunjungan nakes',
  'skrining-jiwa': 'Skrining kesehatan jiwa',
  'kelas-ibu': 'Kelas ibu hamil',
  nifas: 'Kunjungan nifas & vitamin A',
  neonatal: 'Pelayanan neonatal (KN0–KN3)',
  suplementasi: 'Suplementasi balita',
  'pemeriksaan-rutin': 'Pemeriksaan rutin',
  'skrining-geriatri': 'Skrining geriatri',
  'kontak-erat': 'Kontak erat',
}

function layoutAwalSasaran(
  key: SasaranKey,
  fields: KunjunganRumahTemplateField[],
): KunjunganRumahLayoutGroup[] {
  const keys = [
    ...new Set(
      fields
        .map((field) => grupAwalSasaran(key, field.id))
        .filter((group): group is string => !!group),
    ),
  ]
  return keys.map((group, order) => ({
    key: group,
    label: LABEL_GRUP_SASARAN[group] ?? group,
    order,
  }))
}

export function aturanVisibilitasWarisan(
  key: SasaranKey,
  conditionals: ConditionalRule[] = [],
): KunjunganRumahVisibilityRule[] {
  return conditionals.flatMap((rule, index) =>
    rule.dependents.map((targetId) => ({
      id: `legacy-${key}-${index}-${targetId}`,
      targetType: 'field' as const,
      targetId,
      triggerFieldId: rule.trigger,
      operator:
        rule.kind === 'checks'
          ? ('eq' as const)
          : rule.whenNonEmpty
            ? ('tidak_kosong' as const)
            : rule.when !== undefined
              ? ('eq' as const)
              : ('tidak_kosong' as const),
      nilaiAcuan: rule.kind === 'checks' ? true : (rule.when ?? null),
      aktif: true,
      urutan: index,
    })),
  )
}

export interface KunjunganRumahTemplates {
  version: typeof KUNJUNGAN_RUMAH_TEMPLATE_VERSION
  keluargaInfo: KunjunganRumahTemplateField[]
  anggota: KunjunganRumahTemplateField[]
  sanitasi: KunjunganRumahTemplateField[]
  sasaran: Record<SasaranKey, KunjunganRumahSasaranTemplate>
  masalah: KunjunganRumahTemplateField[]
  /** Section non-sasaran dan non-penyimpanan, terurut sesuai DB. */
  sections: KunjunganRumahSectionTemplate[]
  /** Urutan DB section sasaran; dipakai scene menempatkan kartu Form Sasaran. */
  sasaranOrder: number
  hasilOpsi: string[]
  hasilWajib: boolean
}

const NAMA_SECTION_BAWAAN: Record<
  string,
  { kind: KunjunganRumahSectionKind; label: string }
> = {
  keluargaInfo: { kind: 'keluarga', label: 'Data Keluarga' },
  anggota: { kind: 'anggota', label: 'Anggota Keluarga' },
  sanitasi: { kind: 'sanitasi', label: 'Sanitasi & Lingkungan' },
  masalah: { kind: 'masalah', label: 'Masalah & Tindak Lanjut' },
  hasil: { kind: 'hasil', label: 'Hasil Kunjungan' },
}

const KIND_SECTION_BAWAAN: Record<string, KunjunganRumahSectionKind> =
  Object.fromEntries(
    Object.entries(NAMA_SECTION_BAWAAN).map(([nama, def]) => [nama, def.kind]),
  )

export function isKunjunganRumahSectionKind(
  value: unknown,
): value is KunjunganRumahSectionKind {
  return (
    typeof value === 'string' &&
    (KUNJUNGAN_RUMAH_SECTION_KINDS as readonly string[]).includes(value)
  )
}

/**
 * Tentukan peran section.
 *
 * Nama bawaan selalu menang supaya section lama tanpa metadata tetap dirender
 * widget aslinya. Selain itu metadata eksplisit dipakai; absen = generik.
 */
export function resolveSectionKind(
  nama: string,
  declared?: string | null,
): KunjunganRumahSectionKind {
  const bawaan = KIND_SECTION_BAWAAN[nama]
  if (bawaan) return bawaan
  if ((SASARAN_KEYS as readonly string[]).includes(nama)) return 'sasaran'
  if (nama === 'penyimpanan') return 'penyimpanan'
  if (isKunjunganRumahSectionKind(declared)) return declared
  return 'form_generik'
}

/** Label default saat section lama tidak membawa label dari DB. */
export function labelSectionBawaan(nama: string): string {
  return NAMA_SECTION_BAWAAN[nama]?.label ?? nama
}

// ── Default ──
export function createDefaultKunjunganRumahTemplates(): KunjunganRumahTemplates {
  // KeluargaInfo 12 field
  const keluargaDefs: {
    id: string
    label: string
    kind: KunjunganRumahFieldKind
    required: boolean
  }[] = [
    {
      id: 'tglPengumpulan',
      label: 'Tanggal pengumpulan data',
      kind: 'date',
      required: true,
    },
    { id: 'posyandu', label: 'Posyandu', kind: 'text', required: true },
    { id: 'nik', label: 'NIK sasaran utama', kind: 'text', required: true },
    { id: 'kelurahan', label: 'Desa/Kelurahan', kind: 'text', required: false },
    { id: 'kecamatan', label: 'Kecamatan', kind: 'text', required: false },
    { id: 'puskesmas', label: 'Puskesmas', kind: 'text', required: false },
    {
      id: 'pustu',
      label: 'Pustu / posyandu prima',
      kind: 'text',
      required: false,
    },
    {
      id: 'namaKK',
      label: 'Nama kepala keluarga',
      kind: 'text',
      required: false,
    },
    { id: 'alamat', label: 'Alamat', kind: 'text', required: false },
    { id: 'hpKK', label: 'No. HP KK/anggota', kind: 'text', required: false },
    { id: 'kabKota', label: 'Kabupaten/Kota', kind: 'text', required: false },
    { id: 'provinsi', label: 'Provinsi', kind: 'text', required: false },
  ]
  const keluargaInfo: KunjunganRumahTemplateField[] = keluargaDefs.map(
    (d, i) => ({
      id: d.id,
      label: d.label,
      kind: d.kind,
      section: 'keluargaInfo',
      required: d.required,
      active: true,
      order: i,
    }),
  )

  const anggotaDefs: {
    id: string
    label: string
    kind: KunjunganRumahFieldKind
    required: boolean
    options?: string[]
    hint?: string
  }[] = [
    { id: 'nama', label: 'Nama lengkap', kind: 'text', required: true },
    { id: 'nik', label: 'NIK', kind: 'text', required: true },
    { id: 'tglLahir', label: 'Tanggal lahir', kind: 'date', required: true },
    {
      id: 'jk',
      label: 'Jenis kelamin',
      kind: 'select',
      required: false,
      options: ['L', 'P'],
    },
    {
      id: 'hubKK',
      label: 'Hubungan dengan KK',
      kind: 'select',
      required: false,
      options: [
        'Kepala Keluarga',
        'Istri',
        'Anak',
        'Menantu',
        'Cucu',
        'Orang tua',
        'Mertua',
        'Famili lain',
        'Lainnya',
      ],
    },
    {
      id: 'statusKawin',
      label: 'Status perkawinan',
      kind: 'select',
      required: false,
      options: ['Kawin', 'Belum kawin', 'Cerai hidup', 'Cerai mati'],
    },
    {
      id: 'pendidikan',
      label: 'Pendidikan terakhir',
      kind: 'select',
      required: false,
      options: ['Tidak sekolah', 'SD', 'SMP', 'SMA', 'D1/D3', 'S1', 'S2/S3'],
    },
    {
      id: 'pekerjaan',
      label: 'Pekerjaan',
      kind: 'select',
      required: false,
      options: [
        'Petani',
        'Buruh',
        'Nelayan',
        'PNS',
        'Pedagang',
        'Swasta',
        'IRT',
        'Pelajar/Mahasiswa',
        'Tidak bekerja',
        'Lainnya',
      ],
    },
  ]
  const anggota: KunjunganRumahTemplateField[] = anggotaDefs.map((d, i) => ({
    id: d.id,
    label: d.label,
    kind: d.kind,
    section: 'anggota',
    required: d.required,
    active: true,
    order: i,
    options: d.options,
    hint: d.hint,
  }))

  const sanitasiDefs: {
    id: string
    label: string
    kind: KunjunganRumahFieldKind
    options?: string[]
  }[] = [
    { id: 'jkn', label: 'Jaminan kesehatan (JKN/JamKesDa)', kind: 'checkbox' },
    { id: 'ventilasi', label: 'Ventilasi cukup', kind: 'checkbox' },
    { id: 'odgj', label: 'Anggota dgn gangguan jiwa (ODGJ)', kind: 'checkbox' },
    { id: 'tbc', label: 'Anggota terdiagnosa TBC', kind: 'checkbox' },
    {
      id: 'hipertensi',
      label: 'Anggota terdiagnosa hipertensi',
      kind: 'checkbox',
    },
    { id: 'dm', label: 'Anggota terdiagnosa DM', kind: 'checkbox' },
    {
      id: 'jambanSaniter',
      label: '- jamban keluarga -',
      kind: 'select',
      options: ['Kloset', 'Leher angsa', 'Plengseran', 'Cemplung'],
    },
    {
      id: 'jenisAir',
      label: '- sarana air bersih -',
      kind: 'select',
      options: [
        'Sumur terlindung',
        'Ledeng/PDAM',
        'Sumur pompa',
        'Mata air terlindung',
        'Sumur terbuka',
        'Air sungai',
        'Danau / telaga',
        'Lainnya',
      ],
    },
  ]
  const sanitasi: KunjunganRumahTemplateField[] = sanitasiDefs.map((d, i) => ({
    id: d.id,
    label: d.label,
    kind: d.kind,
    section: 'sanitasi',
    required: false,
    active: true,
    order: i,
    options: d.options,
  }))

  const masalahDefs: {
    id: string
    label: string
    kind: KunjunganRumahFieldKind
  }[] = [
    { id: 'nama', label: 'Nama', kind: 'text' },
    { id: 'nik', label: 'NIK', kind: 'text' },
    { id: 'tglLahir', label: 'Tanggal lahir', kind: 'date' },
    { id: 'alamat', label: 'Alamat', kind: 'text' },
    { id: 'telepon', label: 'No. telepon', kind: 'text' },
    { id: 'masalah', label: 'Masalah kesehatan ditemukan', kind: 'text' },
    { id: 'tindakLanjut', label: 'Tindak lanjut', kind: 'text' },
  ]
  const masalah: KunjunganRumahTemplateField[] = masalahDefs.map((d, i) => ({
    id: d.id,
    label: d.label,
    kind: d.kind,
    section: 'masalah',
    required: false,
    active: true,
    order: i,
  }))

  const sasaran = {} as Record<SasaranKey, KunjunganRumahSasaranTemplate>
  for (const def of SASARAN_DEFS) {
    const fields: KunjunganRumahTemplateField[] = []
    let order = 0
    for (const f of def.identitas) {
      fields.push({
        id: f.key,
        label: f.label,
        kind: f.kind,
        section: 'sasaran:identitas',
        sasaranKey: def.key,
        required: false,
        active: true,
        order: order++,
        options: f.options,
      })
    }
    for (const f of def.kolom) {
      const layoutGroup = grupAwalSasaran(def.key, f.key)
      fields.push({
        id: f.key,
        label: f.label,
        kind: f.kind,
        section: 'sasaran:kolom',
        sasaranKey: def.key,
        required: false,
        active: true,
        order: order++,
        options: f.options,
        ...(layoutGroup ? { layoutGroup } : {}),
      })
    }
    for (const b of def.bools) {
      fields.push({
        id: b.key,
        label: b.label,
        kind: 'checkbox',
        section: 'sasaran:bools',
        sasaranKey: def.key,
        required: false,
        active: true,
        order: order++,
      })
    }
    for (const b of def.baha) {
      fields.push({
        id: b.key,
        label: b.label,
        kind: 'checkbox',
        section: 'sasaran:baha',
        sasaranKey: def.key,
        required: false,
        active: true,
        order: order++,
      })
    }
    const legacyRules = aturanVisibilitasWarisan(def.key, def.conditionals)
    for (const field of fields) {
      field.visibilityRules = legacyRules.filter(
        (rule) => rule.targetId === field.id,
      )
    }
    sasaran[def.key] = {
      label: def.label,
      fields,
      layoutGroups: layoutAwalSasaran(def.key, fields),
      prioritasDefault: [...def.prioritasDefault],
    }
  }

  const section = (
    name: string,
    order: number,
    fields: KunjunganRumahTemplateField[],
  ): KunjunganRumahSectionTemplate => ({
    name,
    label: labelSectionBawaan(name),
    description: null,
    kind: resolveSectionKind(name),
    order,
    active: true,
    fields,
    layoutGroups: [],
  })

  const sections: KunjunganRumahSectionTemplate[] = [
    section('keluargaInfo', 0, keluargaInfo),
    section('anggota', 1, anggota),
    section('sanitasi', 2, sanitasi),
    section('masalah', 4, masalah),
    section('hasil', 5, [
      {
        id: 'hasil',
        label: 'Hasil Kunjungan Rumah',
        kind: 'select',
        section: 'hasil',
        required: true,
        active: true,
        order: 0,
        options: [...HASIL_KUNJUNGAN_RUMAH],
      },
    ]),
  ]

  return {
    version: KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
    keluargaInfo,
    anggota,
    sanitasi,
    sasaran,
    masalah,
    sections,
    sasaranOrder: 3,
    hasilOpsi: [...HASIL_KUNJUNGAN_RUMAH],
    hasilWajib: true,
  }
}

const KUNJUNGAN_RUMAH_KINDS: KunjunganRumahFieldKind[] = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
]

function isTemplateField(
  f: unknown,
  expectedSection?: KunjunganRumahTemplateField['section'],
): f is KunjunganRumahTemplateField {
  if (!f || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  if (
    typeof o.id !== 'string' ||
    !o.id ||
    typeof o.label !== 'string' ||
    !o.label
  )
    return false
  if (!KUNJUNGAN_RUMAH_KINDS.includes(o.kind as KunjunganRumahFieldKind))
    return false
  // Section generik boleh bernama apa saja; section bawaan tetap dicocokkan
  // lewat `expectedSection` oleh pemanggil.
  if (typeof o.section !== 'string' || !o.section) return false
  if (expectedSection && o.section !== expectedSection) return false
  if (typeof o.required !== 'boolean' || typeof o.active !== 'boolean')
    return false
  if (typeof o.order !== 'number' || !Number.isFinite(o.order)) return false
  if (o.options !== undefined) {
    const opts: unknown = o.options
    if (!Array.isArray(opts) || !opts.every((x) => typeof x === 'string'))
      return false
    // select wajib punya opsi; checkbox boleh boolean atau multi-pilihan.
    if (o.kind === 'select' && opts.length === 0) return false
    if (o.kind !== 'select' && o.kind !== 'checkbox' && opts.length > 0)
      return false
  }
  if (o.hint !== undefined && typeof o.hint !== 'string') return false
  if (o.placeholder !== undefined && typeof o.placeholder !== 'string')
    return false
  if (o.columns !== undefined && typeof o.columns !== 'number') return false
  if (o.layoutGroup !== undefined && typeof o.layoutGroup !== 'string')
    return false
  if (
    o.visibilityRules !== undefined &&
    (!Array.isArray(o.visibilityRules) ||
      !o.visibilityRules.every((rule) => {
        if (!rule || typeof rule !== 'object') return false
        const value = rule as Record<string, unknown>
        return (
          value.targetType === 'field' &&
          typeof value.targetId === 'string' &&
          typeof value.triggerFieldId === 'string' &&
          typeof value.operator === 'string' &&
          typeof value.aktif === 'boolean' &&
          typeof value.urutan === 'number'
        )
      }))
  )
    return false
  if (
    o.sasaranKey !== undefined &&
    !SASARAN_KEYS.includes(o.sasaranKey as SasaranKey)
  )
    return false
  return true
}

function isLayoutGroup(g: unknown): g is KunjunganRumahLayoutGroup {
  if (!g || typeof g !== 'object') return false
  const o = g as Record<string, unknown>
  return (
    typeof o.key === 'string' &&
    !!o.key &&
    typeof o.label === 'string' &&
    typeof o.order === 'number' &&
    Number.isFinite(o.order)
  )
}

function isSectionTemplate(
  s: unknown,
  expectedName?: string,
): s is KunjunganRumahSectionTemplate {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  if (typeof o.name !== 'string' || !o.name) return false
  if (expectedName && o.name !== expectedName) return false
  if (typeof o.label !== 'string') return false
  if (!isKunjunganRumahSectionKind(o.kind)) return false
  if (typeof o.order !== 'number' || !Number.isFinite(o.order)) return false
  if (typeof o.active !== 'boolean') return false
  if (!Array.isArray(o.layoutGroups) || !o.layoutGroups.every(isLayoutGroup))
    return false
  if (!Array.isArray(o.fields)) return false
  if (!o.fields.every((f) => isTemplateField(f) && f.section === o.name))
    return false
  if (!hasUniqueIds(o.fields)) return false
  return true
}

function hasUniqueIds(fields: unknown[]): boolean {
  const ids = new Set<string>()
  for (const f of fields) {
    if (!isTemplateField(f)) return false
    if (ids.has(f.id)) return false
    ids.add(f.id)
  }
  return true
}

export function validateKunjunganRumahTemplates(
  obj: unknown,
): obj is KunjunganRumahTemplates {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (o.version !== KUNJUNGAN_RUMAH_TEMPLATE_VERSION) return false
  if (
    !Array.isArray(o.keluargaInfo) ||
    !Array.isArray(o.anggota) ||
    !Array.isArray(o.sanitasi) ||
    !Array.isArray(o.masalah)
  )
    return false
  if (!o.keluargaInfo.every((f) => isTemplateField(f, 'keluargaInfo')))
    return false
  if (!o.anggota.every((f) => isTemplateField(f, 'anggota'))) return false
  if (!o.sanitasi.every((f) => isTemplateField(f, 'sanitasi'))) return false
  if (!o.masalah.every((f) => isTemplateField(f, 'masalah'))) return false
  if (!hasUniqueIds(o.keluargaInfo)) return false
  if (!hasUniqueIds(o.anggota)) return false
  if (!hasUniqueIds(o.sanitasi)) return false
  if (!hasUniqueIds(o.masalah)) return false
  if (!Array.isArray(o.sections)) return false
  if (!o.sections.every((s) => isSectionTemplate(s))) return false
  const sectionNames = new Set<string>()
  for (const s of o.sections) {
    if (s.kind === 'sasaran' || s.kind === 'penyimpanan') return false
    if (sectionNames.has(s.name)) return false
    sectionNames.add(s.name)
  }
  if (typeof o.sasaranOrder !== 'number' || !Number.isFinite(o.sasaranOrder))
    return false
  if (typeof o.sasaran !== 'object' || o.sasaran === null) return false
  const sas = o.sasaran as Record<string, unknown>
  for (const key of SASARAN_KEYS) {
    const entry = sas[key] as Record<string, unknown> | undefined
    if (!entry || typeof entry !== 'object') return false
    if (typeof entry.label !== 'string' || !entry.label) return false
    if (!Array.isArray(entry.fields)) return false
    const fields = entry.fields as unknown[]
    if (!fields.every((f) => isTemplateField(f) && f.sasaranKey === key))
      return false
    if (!hasUniqueIds(fields)) return false
    if (
      !Array.isArray(entry.layoutGroups) ||
      !entry.layoutGroups.every(isLayoutGroup)
    )
      return false
    if (
      !Array.isArray(entry.prioritasDefault) ||
      !entry.prioritasDefault.every((x) => typeof x === 'string')
    )
      return false
  }
  // [Iterasi 3 Fix] hasilOpsi wajib berupa array non-kosong berisi string
  if (
    !Array.isArray(o.hasilOpsi) ||
    o.hasilOpsi.length === 0 ||
    !o.hasilOpsi.every((x) => typeof x === 'string' && x.trim() !== '')
  )
    return false
  if (typeof o.hasilWajib !== 'boolean') return false
  return true
}
