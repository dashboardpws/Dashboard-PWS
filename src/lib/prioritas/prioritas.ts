export interface BarisPrioritas {
  id: number
  kode: string
  nama: string
  urutan: number
  aktif: boolean
}

export const KODE_PRIORITAS_SISTEM = [
  'TB',
  'Bumil Risti',
  'Balita Risti',
] as const

export function labelPrioritas(
  kode: string,
  daftar: readonly BarisPrioritas[],
): string {
  return daftar.find((item) => item.kode === kode)?.nama ?? kode
}

export function buatKodePrioritas(
  nama: string,
  daftar: readonly BarisPrioritas[],
) {
  const dasar =
    nama
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'PRIORITAS'
  const dipakai = new Set(daftar.map((item) => item.kode))
  let kode = dasar
  let suffix = 2
  while (dipakai.has(kode)) kode = `${dasar.slice(0, 47)}_${suffix++}`
  return kode
}

export function validasiNamaPrioritas(nama: string): string | null {
  const nilai = nama.trim()
  if (!nilai) return 'Nama prioritas wajib diisi.'
  if (nilai.length > 50) return 'Nama prioritas maksimal 50 karakter.'
  return null
}

export function prioritasSistem(kode: string): boolean {
  return (KODE_PRIORITAS_SISTEM as readonly string[]).includes(kode)
}
