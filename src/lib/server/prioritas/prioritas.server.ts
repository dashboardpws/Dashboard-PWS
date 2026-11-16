import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import { prioritasProgram } from '@/lib/schema/schema'
import {
  buatKodePrioritas,
  prioritasSistem,
  validasiNamaPrioritas,
} from '@/lib/prioritas/prioritas'

export async function listPrioritasProgram() {
  return await db
    .select()
    .from(prioritasProgram)
    .orderBy(asc(prioritasProgram.urutan), asc(prioritasProgram.id))
}

export async function simpanPrioritasProgram(data: {
  kode?: string
  nama: string
}) {
  const nama = data.nama.trim()
  const error = validasiNamaPrioritas(nama)
  if (error) throw new Error(error)
  const daftar = await listPrioritasProgram()
  const duplikat = daftar.find(
    (item) =>
      item.nama.toLocaleLowerCase() === nama.toLocaleLowerCase() &&
      item.kode !== data.kode,
  )
  if (duplikat) throw new Error(`Prioritas "${nama}" sudah ada.`)
  if (data.kode) {
    if (!daftar.some((item) => item.kode === data.kode))
      throw new Error('Prioritas tidak ditemukan.')
    if (prioritasSistem(data.kode))
      throw new Error('Nama prioritas sistem tidak dapat diubah.')
    await db
      .update(prioritasProgram)
      .set({ nama, updatedAt: new Date() })
      .where(eq(prioritasProgram.kode, data.kode))
    return
  }
  const kode = buatKodePrioritas(nama, daftar)
  await db
    .insert(prioritasProgram)
    .values({ kode, nama, urutan: daftar.length + 1 })
}

export async function setPrioritasProgramAktif(kode: string, aktif: boolean) {
  if (prioritasSistem(kode) && !aktif)
    throw new Error('Prioritas sistem tidak dapat dinonaktifkan.')
  const rows = await db
    .update(prioritasProgram)
    .set({ aktif, updatedAt: new Date() })
    .where(eq(prioritasProgram.kode, kode))
    .returning({ id: prioritasProgram.id })
  if (!rows.length) throw new Error('Prioritas tidak ditemukan.')
}
