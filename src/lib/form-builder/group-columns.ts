/** Jenis isian primitif yang aman disimpan sebagai satu sel grup ulang. */
export const TIPE_KOLOM_GROUP = [
  'text',
  'textarea',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
  'time',
] as const

export type TipeKolomGroup = (typeof TIPE_KOLOM_GROUP)[number]

export interface GroupColumnDefinition {
  /** Kunci stabil di dalam setiap baris jawaban, mis. `kolom1`. */
  key: string
  label: string
  type: TipeKolomGroup
  /** Dipakai tipe select/radio; teks nilai dan label sama. */
  options: string[]
}

/** Metadata awal untuk group lama atau kolom baru yang belum dikonfigurasi. */
export function kolomGroupDefault(jumlah: number): GroupColumnDefinition[] {
  return Array.from({ length: Math.max(1, jumlah) }, (_, index) => ({
    key: `kolom${index + 1}`,
    label: `Kolom ${index + 1}`,
    type: 'text',
    options: [],
  }))
}
