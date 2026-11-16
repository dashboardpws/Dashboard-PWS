export interface BarisFasilitas {
  id: number
  nama: string
  tipe: string
  alamat: string
  wilayahKerjaId: number
  kelurahan: string
  kecamatan: string
  jumlahKader: number
}

export interface DraftFasilitas {
  nama: string
  tipe: string
  alamat: string
  wilayahKerjaId: number
}

export interface OpsiWilayah {
  id: number
  kelurahan: string
  kecamatan: string
}

export function validasiFasilitas(draft: DraftFasilitas): string | null {
  if (!draft.nama.trim()) return 'Nama fasilitas wajib diisi.'
  if (draft.nama.trim().length > 20)
    return 'Nama fasilitas maksimal 20 karakter.'
  if (!['Posyandu', 'Pustu'].includes(draft.tipe))
    return 'Jenis fasilitas tidak valid.'
  if (!Number.isInteger(draft.wilayahKerjaId) || draft.wilayahKerjaId <= 0)
    return 'Wilayah kerja wajib dipilih.'
  return null
}
