/**
 * Seed data uji coba yang persisten.
 *
 * Isi database uji dengan akun petugas sintetis dan dua warga dummy supaya alur
 * utama bisa dicoba lewat UI tanpa memakai data nyata. Tidak membuat akun login:
 * login tetap memakai satu PIN global dari environment.
 *
 * PENGAMAN DATABASE
 * -----------------
 * Skrip ini hanya boleh menunjuk database uji. Ia menolak berjalan kalau nama
 * database/URL tidak mengandung salah satu penanda: uji, trial, test,
 * staging, dev, localhost, atau 127.0.0.1. Contoh:
 *
 *     DATABASE_URL="postgresql://.../dashboard_pws_uji_schema" \
 *       pnpm db:seed-uji
 *
 * Skrip ini mengganti seluruh isi `users` dan warga dummy sintetis, jadi hanya
 * dijalankan bila tidak ada submission di `surveys`. Idempoten untuk pemakaian
 * uji coba: warga dummy lama dengan NIK sintetis dibuat ulang dari awal.
 */
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../src/lib/server/db.server'
import {
  dataWargaTable,
  fasilitasKesehatan,
  surveys,
  users,
} from '../src/lib/schema/schema'
import { pastikanDatabaseUji } from '../src/lib/uji/database-uji'

const NIK_DUMMY = ['9000000000000001', '9000000000000002'] as const

// Tidak ada akun 'Admin Uji' lagi. Tabel `users` sekarang murni daftar kader:
// kolom `role` sudah dihapus dari skema, jadi tidak ada cara menandai seseorang
// sebagai admin di sini — dan memang tidak perlu, karena semua sesi valid setara.
const PENGGUNA_UJI = [
  {
    nama: 'Bidan Uji',
    fasilitas: 'Kenanga',
  },
  {
    nama: 'Kader Uji Melati',
    fasilitas: 'Melati 1',
  },
  {
    nama: 'Kader Uji Flamboyan',
    fasilitas: 'Flamboyan',
  },
] as const

async function utama(): Promise<void> {
  pastikanDatabaseUji('seed')

  const [jumlahSurvey] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(surveys)
  if ((jumlahSurvey?.n ?? 0) > 0) {
    throw new Error(
      'Database uji sudah berisi submission. Hapus data uji dulu sebelum mengganti akun dan warga dummy.',
    )
  }

  const fasilitas = await db
    .select({ id: fasilitasKesehatan.id, nama: fasilitasKesehatan.nama })
    .from(fasilitasKesehatan)
  const fasilitasId = new Map(fasilitas.map((f) => [f.nama, f.id]))
  for (const p of PENGGUNA_UJI) {
    if (!fasilitasId.get(p.fasilitas)) {
      throw new Error(
        `Fasilitas "${p.fasilitas}" tidak ada. Siapkan data referensi database uji dulu.`,
      )
    }
  }

  await db
    .delete(dataWargaTable)
    .where(inArray(dataWargaTable.nik, [...NIK_DUMMY]))
  await db.delete(users)

  const penggunaBaru = await db
    .insert(users)
    .values(
      PENGGUNA_UJI.map((p) => ({
        nama: p.nama,
        phone: null,
        aktif: true,
        fasKesId: fasilitasId.get(p.fasilitas)!,
      })),
    )
    .returning({ id: users.id, nama: users.nama })
  const idPengguna = new Map(penggunaBaru.map((p) => [p.nama, p.id]))
  const idPetugas = idPengguna.get('Bidan Uji')
  const idKader = idPengguna.get('Kader Uji Melati')
  if (!idPetugas || !idKader) throw new Error('Akun uji gagal dibuat.')

  await db.insert(dataWargaTable).values([
    {
      nik: NIK_DUMMY[0],
      nama_art: 'WARGA UJI SATU',
      nama_kk: 'WARGA UJI SATU',
      hubungan_keluarga: 'Kepala Keluarga',
      alamat: 'JL UJI COBA 1',
      tgl_lahir: '1990-01-01',
      rt: '001',
      rw: '001',
      kecamatan: 'PANGGUNGREJO',
      kelurahan: 'Trajeng',
      kota: 'Kota Pasuruan',
      status_kawin: 'kawin',
      staff: idPetugas,
      jenis_kelamin: 'perempuan',
      wanita_usia_hamil: false,
      agama: 'Islam',
      pendidikan: 'SLTA/Sederajat',
      pekerjaan: 'IRT',
    },
    {
      nik: NIK_DUMMY[1],
      nama_art: 'WARGA UJI DUA',
      nama_kk: 'WARGA UJI DUA',
      hubungan_keluarga: 'Kepala Keluarga',
      alamat: 'JL UJI COBA 2',
      tgl_lahir: '1985-05-05',
      rt: '002',
      rw: '001',
      kecamatan: 'PANGGUNGREJO',
      kelurahan: 'Ngemplakrejo',
      kota: 'Kota Pasuruan',
      status_kawin: 'kawin',
      staff: idKader,
      jenis_kelamin: 'laki-laki',
      wanita_usia_hamil: false,
      agama: 'Islam',
      pendidikan: 'SLTA/Sederajat',
      pekerjaan: 'Buruh',
    },
  ])

  const [cekWarga] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dataWargaTable)
    .where(inArray(dataWargaTable.nik, [...NIK_DUMMY]))
  console.log(`OK akun uji: ${penggunaBaru.length} akun.`)
  console.log(
    `OK warga dummy: ${cekWarga?.n ?? 0} baris (${NIK_DUMMY.join(', ')}).`,
  )
}

utama()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('SEED UJI GAGAL:', e)
    process.exit(1)
  })
