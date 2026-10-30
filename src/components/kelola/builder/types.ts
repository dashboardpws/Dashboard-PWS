import type { TipeField } from '@/lib/service/form-builder/validasi'
import {
  SEMUA_TIPE_FIELD,
  TIPE_BUTUH_OPSI,
} from '@/lib/service/form-builder/validasi'
import type {
  RuleAutofill,
  RuleVisibilitas,
} from '@/lib/form-builder/engine/types'

export type TipeFieldEditor = TipeField

export { SEMUA_TIPE_FIELD, TIPE_BUTUH_OPSI }

export const TIPE_FIELD_LABELS: Record<TipeFieldEditor, string> = {
  text: 'Teks pendek',
  textarea: 'Teks panjang',
  number: 'Angka',
  select: 'Pilihan (select)',
  radio: 'Pilihan (radio)',
  checkbox: 'Checkbox',
  date: 'Tanggal',
  time: 'Waktu',
  image: 'Gambar',
  file: 'File',
  group: 'Grup ulang',
}

export interface FlatNode {
  kind: 'section' | 'field'
  clientId: string
  /** Section asal untuk node field. null hanya untuk field yatim. */
  parentKey: string | null
  index: number
}

export interface DraftOpsi {
  clientId: string
  value: string
  label: string
  aktif: boolean
}

export interface DraftField {
  id: string | null
  clientId: string
  sectionClientId: string
  nama: string
  label: string
  tipe: TipeFieldEditor
  wajib: boolean
  aktif: boolean
  placeholder: string | null
  deskripsi: string | null
  jumlahKolom: number | null
  /**
   * Sumber pilihan jawaban dari data yang sudah ada (agama, petugas, data warga,
   * dst). null = admin mengetik sendiri pilihannya di `opsi`. Nilai yang sah
   * ada di `sumber-opsi.ts`; server menolak yang tidak dikenal saat Build.
   */
  optionSourceType: string | null
  optionSourceKey: string | null
  opsi: DraftOpsi[]
}

export interface DraftSection {
  id: string | null
  clientId: string
  nama: string
  deskripsi: string | null
  aktif: boolean
}

export interface DraftFormDocument {
  formVersionId: string
  sections: DraftSection[]
  fields: DraftField[]
  rulesAutofill?: RuleAutofill[]
  rulesVisibilitas?: RuleVisibilitas[]
}

export interface BuildFormVersionInput {
  formVersionId: string
  sections: {
    clientId: string
    id: string | null
    nama: string
    deskripsi: string | null
    aktif: boolean
  }[]
  fields: {
    clientId: string
    id: string | null
    sectionClientId: string
    nama: string
    label: string
    tipe: TipeFieldEditor
    wajib: boolean
    aktif: boolean
    placeholder: string | null
    deskripsi: string | null
    jumlahKolom: number | null
    optionSourceType: string | null
    optionSourceKey: string | null
    opsi: { value: string; label: string; urutan: number; aktif: boolean }[]
  }[]
  rulesAutofill: RuleAutofill[]
  rulesVisibilitas: RuleVisibilitas[]
  actorId?: string | null
}

export interface BuildFormVersionResult {
  jumlahSection: number
  jumlahField: number
  jumlahDihapus: number
}

export type SelectedItem =
  | { type: 'section'; clientId: string }
  | { type: 'field'; clientId: string }
  | null

export interface PaletteItem {
  tipe: TipeFieldEditor
  label: string
  icon: string
}
