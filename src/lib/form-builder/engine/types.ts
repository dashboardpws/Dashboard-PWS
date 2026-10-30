/**
 * Tipe untuk engine autofill dan visibilitas.
 * Pure types - tidak ada dependensi React/DOM.
 */

export type SumberAutofill = 'warga' | 'anggota' | 'riwayat'
export type TransformAutofill = 'teks' | 'nik' | 'tanggal' | 'opsi' | 'angka'
export type ModeAutofill = 'isi_kosong' | 'timpa'

export interface RuleAutofill {
  id: string
  triggerFieldId: string
  targetFieldId: string
  sumber: SumberAutofill
  kolom: string
  transform: TransformAutofill
  mode: ModeAutofill
  aktif: boolean
  urutan: number
}

export type TargetVisibilitas = 'field' | 'section'
export type OperatorVisibilitas =
  'eq' | 'neq' | 'in' | 'nin' | 'kosong' | 'tidak_kosong'

export type NilaiJSON =
  string | number | boolean | null | NilaiJSON[] | { [key: string]: NilaiJSON }

export interface RuleVisibilitas {
  id: string
  targetType: TargetVisibilitas
  targetId: string // fieldId atau sectionId
  triggerFieldId: string
  operator: OperatorVisibilitas
  nilaiAcuan: NilaiJSON
  aktif: boolean
  urutan: number
}

// Konteks data yang tersedia untuk engine
export interface KonteksAutofill {
  // Hasil pilih warga dari cari_warga
  wargaTerpilih?: {
    nik: string
    namaArt?: string | null
    namaKk?: string | null
    tglLahir?: string | null // YYYY-MM-DD
    alamat?: string | null
    rt?: string | null
    rw?: string | null
    kelurahan?: string | null
    kecamatan?: string | null
    jenisKelamin?: string | null
    statusKawin?: string | null
    agama?: string | null
    pendidikan?: string | null
    pekerjaan?: string | null
    [k: string]: unknown
  } | null
  // Anggota keluarga (dari field bertipe group)
  anggotaKeluarga?: Array<Record<string, unknown>>
  // Riwayat kunjungan/survey untuk warga ini
  riwayat?: Array<Record<string, unknown>>
}

export interface HasilEvaluasiVisibilitas {
  fieldAktif: Set<string>
  sectionAktif: Set<string>
  // field/section yang harus dibersihkan karena jadi tidak aktif
  toClearField: Set<string>
  toClearSection: Set<string>
}
