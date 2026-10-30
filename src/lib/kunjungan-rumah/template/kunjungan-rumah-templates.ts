import { HASIL_KUNJUNGAN_RUMAH } from '@/lib/constants'
import { SASARAN_DEFS, SASARAN_KEYS } from './kunjungan-rumah-form'
import type { SasaranKey } from './kunjungan-rumah-form'

export const KUNJUNGAN_RUMAH_TEMPLATE_VERSION = 17 as const

// ── Tipe ──
export type KunjunganRumahFieldKind =
  'text' | 'number' | 'date' | 'select' | 'checkbox'
export type KunjunganRumahSection =
  | 'keluargaInfo'
  | 'anggota'
  | 'sanitasi'
  | 'sasaran:identitas'
  | 'sasaran:kolom'
  | 'sasaran:bools'
  | 'sasaran:baha'
  | 'masalah'
  | 'hasil'

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
}

export interface KunjunganRumahSasaranTemplate {
  label: string
  fields: KunjunganRumahTemplateField[]
  prioritasDefault: string[]
}

export interface KunjunganRumahTemplates {
  version: typeof KUNJUNGAN_RUMAH_TEMPLATE_VERSION
  keluargaInfo: KunjunganRumahTemplateField[]
  anggota: KunjunganRumahTemplateField[]
  sanitasi: KunjunganRumahTemplateField[]
  sasaran: Record<SasaranKey, KunjunganRumahSasaranTemplate>
  masalah: KunjunganRumahTemplateField[]
  hasilOpsi: string[]
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
    sasaran[def.key] = {
      label: def.label,
      fields,
      prioritasDefault: [...def.prioritasDefault],
    }
  }

  return {
    version: KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
    keluargaInfo,
    anggota,
    sanitasi,
    sasaran,
    masalah,
    hasilOpsi: [...HASIL_KUNJUNGAN_RUMAH],
  }
}

const KUNJUNGAN_RUMAH_KINDS: KunjunganRumahFieldKind[] = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
]
const KUNJUNGAN_RUMAH_SECTIONS: KunjunganRumahSection[] = [
  'keluargaInfo',
  'anggota',
  'sanitasi',
  'sasaran:identitas',
  'sasaran:kolom',
  'sasaran:bools',
  'sasaran:baha',
  'masalah',
  'hasil',
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
  if (!KUNJUNGAN_RUMAH_SECTIONS.includes(o.section as KunjunganRumahSection))
    return false
  if (expectedSection && o.section !== expectedSection) return false
  if (typeof o.required !== 'boolean' || typeof o.active !== 'boolean')
    return false
  if (typeof o.order !== 'number' || !Number.isFinite(o.order)) return false
  if (o.options !== undefined) {
    const opts: unknown = o.options
    if (!Array.isArray(opts) || !opts.every((x) => typeof x === 'string'))
      return false
    // select wajib punya opsi; non-select tidak boleh bawa opsi
    if (o.kind === 'select' && opts.length === 0) return false
    if (o.kind !== 'select' && opts.length > 0) return false
  }
  if (o.hint !== undefined && typeof o.hint !== 'string') return false
  if (
    o.sasaranKey !== undefined &&
    !SASARAN_KEYS.includes(o.sasaranKey as SasaranKey)
  )
    return false
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
      !Array.isArray(entry.prioritasDefault) ||
      !entry.prioritasDefault.every((x) => typeof x === 'string')
    )
      return false
  }
  if (
    !Array.isArray(o.hasilOpsi) ||
    o.hasilOpsi.length === 0 ||
    !o.hasilOpsi.every((x) => typeof x === 'string')
  )
    return false
  return true
}
