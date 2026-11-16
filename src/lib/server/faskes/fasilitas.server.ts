import { count, eq } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import { fasilitasKesehatan, users, wilayahKerja } from '@/lib/schema/schema'
import { validasiFasilitas } from '@/lib/faskes/fasilitas'

export async function listFasilitas() {
  return await db
    .select({
      id: fasilitasKesehatan.id,
      nama: fasilitasKesehatan.nama,
      tipe: fasilitasKesehatan.fasKesType,
      alamat: fasilitasKesehatan.alamat,
      wilayahKerjaId: wilayahKerja.id,
      kelurahan: wilayahKerja.kelurahan,
      kecamatan: wilayahKerja.kecamatan,
      jumlahKader: count(users.id).mapWith(Number),
    })
    .from(fasilitasKesehatan)
    .innerJoin(
      wilayahKerja,
      eq(wilayahKerja.id, fasilitasKesehatan.wilayahKerjaId),
    )
    .leftJoin(users, eq(users.fasKesId, fasilitasKesehatan.id))
    .groupBy(fasilitasKesehatan.id, wilayahKerja.id)
    .orderBy(wilayahKerja.kelurahan, fasilitasKesehatan.nama)
}

export async function listWilayahKerjaOpsi() {
  return await db
    .select({
      id: wilayahKerja.id,
      kelurahan: wilayahKerja.kelurahan,
      kecamatan: wilayahKerja.kecamatan,
    })
    .from(wilayahKerja)
    .orderBy(wilayahKerja.kelurahan)
}

export async function simpanFasilitas(data: {
  id?: number
  nama: string
  tipe: string
  alamat: string
  wilayahKerjaId: number
}) {
  const error = validasiFasilitas(data)
  if (error) throw new Error(error)
  const wilayah = await db
    .select({ id: wilayahKerja.id })
    .from(wilayahKerja)
    .where(eq(wilayahKerja.id, data.wilayahKerjaId))
    .limit(1)
  if (!wilayah.length) throw new Error('Wilayah kerja tidak ditemukan.')
  const values = {
    nama: data.nama.trim(),
    fasKesType: data.tipe as 'Posyandu' | 'Pustu',
    alamat: data.alamat.trim(),
    wilayahKerjaId: data.wilayahKerjaId,
    updatedAt: new Date(),
  }
  if (data.id) {
    await db
      .update(fasilitasKesehatan)
      .set(values)
      .where(eq(fasilitasKesehatan.id, data.id))
    return
  }
  await db.insert(fasilitasKesehatan).values(values)
}

export async function hapusFasilitas(id: number) {
  const [row] = await db
    .select({ kader: count(users.id).mapWith(Number) })
    .from(fasilitasKesehatan)
    .leftJoin(users, eq(users.fasKesId, fasilitasKesehatan.id))
    .where(eq(fasilitasKesehatan.id, id))
    .groupBy(fasilitasKesehatan.id)
  if (!row) throw new Error('Fasilitas tidak ditemukan.')
  if (row.kader) throw new Error(`Fasilitas masih dipakai ${row.kader} kader.`)
  await db.delete(fasilitasKesehatan).where(eq(fasilitasKesehatan.id, id))
}
