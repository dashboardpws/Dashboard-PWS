/**
 * Uji asap (smoke test) jalur simpan kegiatan v2 terhadap database uji.
 *
 * Ini BUKAN bagian dari `pnpm db:seed` dan tidak ikut `vitest run`. Tujuannya
 * memeriksa hal yang tidak bisa dibuktikan unit test: bahwa UUID `users` benar
 * bisa masuk ke `surveys.petugasId`, nama field-petugas benar-benar cocok dengan
 * yang ditulis migration, dan opsinya benar-benar ter-resolve dari `users`.
 *
 * Semua yang dibuat file ini DIHAPUS di akhir, jadi database kembali seperti
 * sebelum dijalankan. Kalau ada langkah yang gagal sebelum cleanup, cari submission
 * kegiatan sisa dengan `surveys.formVersionId` = versi form kegiatan.
 *
 * Hanya database uji yang diterima. Jalankan dengan override eksplisit,
 * misalnya:
 *
 *     DATABASE_URL="postgresql://.../dashboard_pws_uji_schema" \
 *       pnpm db:smoke-kegiatan
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/lib/server/db.server'
import { pastikanDatabaseUji } from '../src/lib/uji/database-uji'
import { surveys } from '../src/lib/schema/schema'
import {
  simpanKegiatan,
  listKegiatan,
} from '../src/lib/server/survey/kegiatan.server.ts'
import { listPetugasOpsi } from '../src/lib/server/petugas/user-registry.server.ts'
import { querySurveyStatsByNik } from '../src/lib/server/sasaran.server'
import { resolveOpsiDinamis } from '../src/lib/server/form-builder/option-source.server.ts'

async function main(): Promise<void> {
  pastikanDatabaseUji('smoke test')
  const petugas = await listPetugasOpsi(null)
  console.log(`Petugas aktif yang bisa dipilih: ${petugas.length}`)
  for (const p of petugas) console.log(`  - ${p.nama} (${p.fasKes}) id=${p.id}`)
  if (petugas.length === 0)
    throw new Error('Tidak ada petugas aktif; dropdown akan kosong.')

  const { opsi } = await resolveOpsiDinamis({ optionSourceType: 'users' })
  console.log(`Opsi dinamis untuk field Petugas: ${opsi.length}`)
  const idOpsi = new Set(opsi.map((o) => o.value))
  for (const p of petugas) {
    if (!idOpsi.has(p.id)) {
      throw new Error(
        `Petugas aktif ${p.nama} tidak muncul sebagai opsi dinamis.`,
      )
    }
  }
  if (idOpsi.size !== opsi.length) {
    throw new Error('Opsi dinamis petugas mengandung ID duplikat.')
  }

  const created: string[] = []

  try {
    const row = await simpanKegiatan({
      nama: 'Uji asap kegiatan',
      jenis: 'Penyuluhan',
      petugas: petugas[0]!.id,
      tgl: '2026-09-28',
      jam: '09:00',
      lokasi: 'Balai RW 01',
      kel: 'Trajeng',
      posy: 'Melati 1',
      target: '10 ibu',
      deskripsi: 'Dibuat oleh smoke test.',
      hadir: 1,
      total: 2,
      foto: 0,
      peserta: [
        { nama: 'Ibu Warsini', kel: 'Trajeng', hadir: true },
        { nama: 'Ibu Lastri', kel: 'Trajeng', hadir: false },
      ],
    })
    created.push(row.id)
    console.log(`OK disimpan: id=${row.id} petugas=${row.petugas}`)

    const semua = await listKegiatan()
    const ketemu = semua.find((r) => r.id === row.id)
    if (!ketemu)
      throw new Error(
        'Submission yang baru disimpan tidak muncul di listKegiatan().',
      )
    console.log(
      `OK dibaca balik: nama="${ketemu.nama}" kel=${ketemu.kel} hadir=${ketemu.hadir}/${ketemu.total} ` +
        `peserta=${ketemu.peserta.length} petugas="${ketemu.petugas}" jam="${ketemu.jam}"`,
    )
    const diharapkan = {
      nama: 'Uji asap kegiatan',
      jenis: 'Penyuluhan',
      petugas: petugas[0]!.nama,
      petugasId: petugas[0]!.id,
      tgl: '2026-09-28',
      jam: '09:00',
      lokasi: 'Balai RW 01',
      kel: 'Trajeng',
      posy: 'Melati 1',
      target: '10 ibu',
      deskripsi: 'Dibuat oleh smoke test.',
      hadir: 1,
      total: 2,
      peserta: [
        { nama: 'Ibu Warsini', kel: 'Trajeng', hadir: true },
        { nama: 'Ibu Lastri', kel: 'Trajeng', hadir: false },
      ],
    }
    for (const [key, nilai] of Object.entries(diharapkan)) {
      if (
        JSON.stringify(ketemu[key as keyof typeof ketemu]) !==
        JSON.stringify(nilai)
      ) {
        throw new Error(`Field ${key} tidak kembali utuh setelah simpan/baca.`)
      }
    }

    // Submission kegiatan tidak punya warga, jadi tidak boleh ikut terhitung
    // sebagai kunjungan rumah di statistik dashboard/sasaran.
    const statistik = await querySurveyStatsByNik()
    if (statistik.some((s) => (s.nik as unknown) === null)) {
      throw new Error(
        'Statistik ikut menghitung submission kegiatan tanpa warga.',
      )
    }
    console.log(
      'OK statistik: kegiatan tanpa warga tidak ikut total kunjungan.',
    )

    // ID petugas yang tidak dikenal harus ditolak, bukan diteruskan ke kolom
    // uuid dan ditolak Postgres dengan pesan yang tidak bisa dibaca petugas.
    const AGA_DIKETAHUI = '00000000-0000-0000-0000-000000000000'
    let pesanDitolak: string | null = null
    try {
      const bocahan = await simpanKegiatan({
        nama: 'Harus ditolak',
        jenis: 'Posyandu',
        petugas: AGA_DIKETAHUI,
        tgl: '2026-09-28',
        jam: '10:00',
        lokasi: 'X',
        kel: 'Trajeng',
        target: '',
        posy: '',
        deskripsi: '',
        hadir: 0,
        total: 0,
        foto: 0,
        peserta: [],
      })
      created.push(bocahan.id)
    } catch (e) {
      pesanDitolak = e instanceof Error ? e.message : String(e)
    }
    if (pesanDitolak === null) {
      throw new Error(
        `ID petugas ngawur tersimpan; seharusnya ditolak. Sisa: ${created.at(-1)}`,
      )
    }
    console.log(`OK ditolak seperti seharusnya: ${pesanDitolak}`)
  } finally {
    for (const id of created) {
      await db.delete(surveys).where(eq(surveys.id, id))
      console.log(`Dihapus sisa uji: ${id}`)
    }
  }
}

main()
  .then(() => {
    console.log('SMOKE TEST OK')
    process.exit(0)
  })
  .catch((e) => {
    console.error('SMOKE TEST GAGAL:', e)
    process.exit(1)
  })
