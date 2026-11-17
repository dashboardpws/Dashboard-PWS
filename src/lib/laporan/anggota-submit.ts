/**
 * Normalisasi daftar ART dari payload `record_legacy` untuk collapse
 * "Pratinjau Data" di halaman laporan.
 *
 * Record kunjungan rumah menyimpan anggota sebagai `anggota`; payload lama
 * memakai `anggotaKeluarga`. Keduanya dibaca supaya submit lama tetap bisa
 * dibuka. Hanya identitas yang diambil — laporan butuh daftar ART, bukan
 * seluruh isian kunjungan.
 */

export interface AnggotaRingkas {
  nama: string
  nik: string
  tglLahir: string
  jk: string
  hubKK: string
}

function teks(nilai: unknown): string {
  return typeof nilai === 'string' ? nilai.trim() : ''
}

function daftarAnggota(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const rec = payload as Record<string, unknown>
  if (Array.isArray(rec.anggota)) return rec.anggota
  if (Array.isArray(rec.anggotaKeluarga)) return rec.anggotaKeluarga
  return []
}

/**
 * Baris yang seluruh identitasnya kosong dibuang. Baris seperti itu bisa
 * tersimpan saat kader menekan "+ Tambah anggota" lalu langsung menyimpan;
 * deretan tanda hubung di laporan hanya menambah noise.
 */
export function ringkasAnggota(payload: unknown): AnggotaRingkas[] {
  return daftarAnggota(payload).flatMap((baris) => {
    if (!baris || typeof baris !== 'object') return []
    const b = baris as Record<string, unknown>
    const anggota: AnggotaRingkas = {
      nama: teks(b.nama),
      nik: teks(b.nik),
      tglLahir: teks(b.tglLahir),
      jk: teks(b.jk),
      hubKK: teks(b.hubKK),
    }
    return Object.values(anggota).some((v) => v !== '') ? [anggota] : []
  })
}
