/**
 * Uji asap alur kunjungan rumah terhadap database uji coba.
 *
 * Cakupan: NIK sasaran utama tersimpan sebagai `surveys.wargaNik`, petugas
 * tersimpan sebagai `surveys.petugasId`, payload bisa dibaca balik, dan
 * query dashboard/sasaran mengenali warga dummy tersebut.
 *
 * PENGAMAN DATABASE
 * -----------------
 * Skrip ini hanya boleh menunjuk database uji. Ia menolak berjalan kalau nama
 * database/URL tidak mengandung salah satu penanda: uji, trial, test,
 * staging, dev, localhost, atau 127.0.0.1. Jalankan dengan override eksplisit,
 * misalnya:
 *
 *     DATABASE_URL="postgresql://.../dashboard_pws_uji_schema" \
 *       pnpm db:smoke-kunjungan-rumah
 *
 * Semua baris dummy memakai NIK sintetis `9000000000000001` dan dihapus di
 * akhir, termasuk bila ada sisa dari penjalanan sebelumnya.
 */
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import { pastikanDatabaseUji } from '@/lib/uji/database-uji'
import { dataWargaTable, surveys } from '@/lib/schema/schema'
import { HASIL_KUNJUNGAN_RUMAH, KODE_FORM_BAWAAN } from '@/lib/constants'
import { ambilDefinisiVersi } from '../src/lib/server/form-builder/section.server.ts'
import { buildFormVersion } from '../src/lib/server/form-builder/build.server.ts'
import {
  buatDraftBerikutnya,
  terbitkanVersiForm,
} from '../src/lib/server/form-builder/form-version.server.ts'
import { listPetugasOpsi } from '../src/lib/server/petugas/user-registry.server.ts'
import {
  getKunjunganRumahRecord,
  listKunjunganRumahRecords,
  updateKunjunganRumahRecord,
  removeKunjunganRumahRecord,
  saveKunjunganRumahRecord,
} from '@/lib/server/kunjungan-rumah.server'
import { querySurveysWithWarga } from '@/lib/server/submit.server'
import {
  querySurveyStatsByNik,
  queryWargaList,
} from '@/lib/server/sasaran.server'

const NIK_DUMMY = '9000000000000901'

/**
 * Daftar versi form kunjungan rumah beserta statusnya, dipakai sebagai
 * bandingan sebelum dan sesudah pengujian yang menerbitkan versi baru.
 */
async function snapshotVersiKunjunganRumah() {
  return (await db.execute(sql`
    SELECT v.id, v.version, v.status
    FROM form_versions v
    JOIN forms f ON f.id = v."formId"
    WHERE f.kode = ${KODE_FORM_BAWAAN.kunjunganRumah}
    ORDER BY v.version
  `)) as { id: string; version: number; status: string }[]
}

/**
 * Kembalikan daftar versi ke keadaan semula.
 *
 * PERINGATAN: ini membersihkan dengan sendirinya, bukan lewat rollback.
 * `terbitkanVersiForm()` membuka `db.transaction` sendiri, jadi tidak bisa
 * dibungkus `dalamTransaksiUji()` — pemanggilnya akan mengambil koneksi lain
 * dan menunggu kunci yang dipegang transaksi luar. Karena itu skrip ini tidak
 * boleh pernah menunjuk database produksi; cleanup-nya diverifikasi lewat
 * `snapshotVersiKunjunganRumah()` yang dibandingkan sebelum dan sesudah.
 */
async function pulihkanVersiKunjunganRumah(
  snapshot: { id: string; status: string }[],
): Promise<void> {
  const idsSnapshot = snapshot.map((r) => r.id)
  const dihapus = await db.execute(sql`
    DELETE FROM form_versions
    WHERE "formId" = (SELECT id FROM forms WHERE kode = ${KODE_FORM_BAWAAN.kunjunganRumah})
      AND NOT (id = ANY(${idsSnapshot}::uuid[]))
    RETURNING version
  `)
  if (dihapus.length > 0) {
    console.log(
      `   dibuang versi percobaan: ${dihapus.map((r) => (r as { version: number }).version).join(', ')}`,
    )
  }
  for (const baris of snapshot) {
    await db.execute(sql`
      UPDATE form_versions
      SET status = ${baris.status}::form_version_status,
          "publishedAt" = (CASE WHEN ${baris.status} = 'published' THEN now() ELSE NULL END)
      WHERE id = ${baris.id}
    `)
  }
}

async function bersihkanSisaDummy(): Promise<void> {
  await db.delete(surveys).where(eq(surveys.wargaNik, NIK_DUMMY))
  await db.delete(dataWargaTable).where(eq(dataWargaTable.nik, NIK_DUMMY))
}

async function main(): Promise<void> {
  pastikanDatabaseUji('smoke test')
  await bersihkanSisaDummy()

  const [petugas] = await listPetugasOpsi(null)
  if (!petugas) throw new Error('Tidak ada petugas aktif di database uji.')

  await db.insert(dataWargaTable).values({
    nik: NIK_DUMMY,
    nama_art: 'UJI COBA DUMMY',
    nama_kk: 'UJI COBA DUMMY',
    hubungan_keluarga: 'Kepala Keluarga',
    alamat: 'JL UJI COBA 1',
    tgl_lahir: '1990-01-01',
    rt: '001',
    rw: '001',
    kecamatan: 'PANGGUNGREJO',
    kelurahan: 'Trajeng',
    kota: 'Kota Pasuruan',
    status_kawin: 'kawin',
    staff: petugas.id,
    jenis_kelamin: 'perempuan',
    wanita_usia_hamil: false,
    agama: 'Islam',
    pendidikan: 'SLTA/Sederajat',
    pekerjaan: 'IRT',
  })

  const hariIni = new Date().toISOString().slice(0, 10)
  const sekarang = new Date().toISOString()
  let idTersimpan: string | null = null

  try {
    const tersimpan = await saveKunjunganRumahRecord({
      waktuSimpan: sekarang,
      info: {
        tglPengumpulan: hariIni,
        alamat: 'JL UJI COBA 1',
        kelurahan: 'Trajeng',
        kecamatan: 'PANGGUNGREJO',
        kabKota: 'Kota Pasuruan',
        provinsi: 'Jawa Timur',
        hpKK: '080000000001',
        puskesmas: 'Puskesmas Trajeng',
        pustu: '',
        posyandu: petugas.fasKes,
        namaKK: 'UJI COBA DUMMY',
        nik: NIK_DUMMY,
        petugasId: petugas.id,
        petugasNama: petugas.nama,
      },
      sanitasi: {
        jkn: true,
        jenisAir: 'Ledeng/PDAM',
        jambanSaniter: 'Kloset',
        ventilasi: true,
        odgj: false,
        tbc: false,
        hipertensi: false,
        dm: false,
      },
      anggota: [
        {
          id: 'uji-anggota-1',
          nama: 'UJI COBA DUMMY',
          nik: NIK_DUMMY,
          tglLahir: '1990-01-01',
          jk: 'P',
          hubKK: 'Kepala Keluarga',
          statusKawin: 'kawin',
          pendidikan: 'SLTA/Sederajat',
          pekerjaan: 'IRT',
        },
      ],
      penilaian: [
        {
          id: 'uji-nilai-1',
          anggotaId: 'uji-anggota-1',
          sasaran: 'dewasa',
          values: {},
          checks: {},
          prioritas: [],
        },
      ],
      masalah: [],
      hasil: HASIL_KUNJUNGAN_RUMAH[0],
      jadwal: '',
      ttd: petugas.nama,
      fotos: [
        {
          id: 'uji-foto-1',
          name: 'uji.png',
          dataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          caption: 'Foto uji',
          takenAt: sekarang,
        },
      ],
    })
    const tersimpanSebagai = tersimpan as { id?: unknown }
    if (typeof tersimpanSebagai.id !== 'string' || !tersimpanSebagai.id) {
      throw new Error('Respons simpan kunjungan tidak berisi id.')
    }
    idTersimpan = tersimpanSebagai.id
    console.log(`OK disimpan: id=${idTersimpan}`)

    const daftar = await listKunjunganRumahRecords()
    if (!daftar.some((r) => (r as { id?: unknown }).id === idTersimpan)) {
      throw new Error(
        'Kunjungan yang baru disimpan tidak muncul di daftar riwayat.',
      )
    }
    const satu = await getKunjunganRumahRecord(idTersimpan)
    const info = (
      satu as { info?: { nik?: unknown; petugasId?: unknown } } | null
    )?.info
    if (info?.nik !== NIK_DUMMY || info?.petugasId !== petugas.id) {
      throw new Error(
        'Payload yang dibaca balik tidak sama dengan yang disimpan.',
      )
    }
    console.log('OK dibaca balik: NIK dan petugas utuh.')

    const warga = await queryWargaList()
    if (!warga.some((w) => w.nik === NIK_DUMMY)) {
      throw new Error('Warga dummy tidak muncul di Data Sasaran.')
    }
    const statistik = await querySurveyStatsByNik()
    const baris = statistik.find((s) => s.nik === NIK_DUMMY)
    if (!baris || baris.total !== 1 || baris.terakhir !== hariIni) {
      throw new Error('Statistik dashboard tidak mengenali kunjungan dummy.')
    }
    const terbaru = await querySurveysWithWarga(50)
    const barisTerbaru = terbaru.find((s) => s.nik === NIK_DUMMY)
    if (!barisTerbaru || barisTerbaru.petugas !== petugas.nama) {
      throw new Error(
        'Daftar kunjungan terbaru tidak menampilkan petugas dummy.',
      )
    }
    console.log('OK dashboard/sasaran: warga, statistik, dan petugas terbaca.')

    await ujiRoundTripNamaField()
    await ujiTerbitkanVersiBaru()
    await ujiUpdateRecordVersiLama()
  } finally {
    if (idTersimpan) {
      await removeKunjunganRumahRecord(idTersimpan)
      console.log(`Dihapus kunjungan uji: ${idTersimpan}`)
    }
    await bersihkanSisaDummy()
  }
}

/**
 * Nama field form bawaan disimpan ber-namespace (`<section>::<id>`) supaya tetap
 * unik per versi form walau id-nya dipakai ulang antar section. Editor membaca
 * bentuk pendeknya dan `buildFormVersion()` menambahkan namespace kembali, jadi
 * build berulang tidak boleh menambah `::` ganda.
 */
async function ujiRoundTripNamaField(): Promise<void> {
  const formId = (
    await db.execute(
      sql`SELECT id FROM forms WHERE kode = ${KODE_FORM_BAWAAN.kunjunganRumah}`,
    )
  )[0] as { id: number }

  const published = (
    await db.execute(sql`
    SELECT v.schema
    FROM form_versions v
    WHERE v."formId" = ${formId.id} AND v.status = 'published'
  `)
  )[0] as { schema: { sections: Array<{ fields: Array<{ name: string }> }> } }
  const sebelum = published.schema.sections
    .flatMap((section) => section.fields.map((field) => field.name))
    .sort()

  const draft = await buatDraftBerikutnya(formId.id)
  try {
    const definisi = await ambilDefinisiVersi(draft)
    const semuaNama = definisi.sections.flatMap((s) =>
      s.fields.map((f) => f.nama),
    )
    if (semuaNama.some((n) => n.includes('::'))) {
      throw new Error(
        'Editor masih menerima nama field ber-prefix :: — namespace belum dibuka.',
      )
    }
    if (!semuaNama.includes('nik')) {
      throw new Error('Nama field bentuk pendek tidak terbaca di editor.')
    }

    await buildFormVersion({
      formVersionId: draft,
      sections: definisi.sections.map((s, i) => ({
        clientId: s.id ?? `sec-${i}`,
        id: s.id ?? null,
        nama: s.nama,
        deskripsi: s.deskripsi ?? null,
        aktif: s.aktif ?? true,
      })),
      fields: definisi.sections.flatMap((s, i) =>
        s.fields.map((f, j) => ({
          clientId: f.id ?? `f-${i}-${j}`,
          id: f.id ?? null,
          sectionClientId: s.id ?? `sec-${i}`,
          nama: f.nama,
          label: f.label,
          tipe: f.tipe,
          wajib: f.wajib ?? false,
          aktif: f.aktif ?? true,
          placeholder: f.placeholder ?? null,
          deskripsi: f.deskripsi ?? null,
          jumlahKolom: f.jumlahKolom ?? null,
          optionSourceType: f.optionSourceType ?? null,
          optionSourceKey: f.optionSourceKey ?? null,
          opsi: f.opsi.map((o, k) => ({
            value: o.value ?? '',
            label: o.label,
            urutan: o.urutan ?? k,
            aktif: o.aktif ?? true,
          })),
        })),
      ),
    } as Parameters<typeof buildFormVersion>[0])

    const built = (
      await db.execute(sql`
      SELECT schema FROM form_versions WHERE id = ${draft}
    `)
    )[0] as { schema: { sections: Array<{ fields: Array<{ name: string }> }> } }
    const sesudah = built.schema.sections
      .flatMap((section) => section.fields.map((field) => field.name))
      .sort()

    if (sesudah.some((n) => n.includes(':::'))) {
      throw new Error('Build menambahkan prefix ganda pada nama field.')
    }
    if (JSON.stringify(sesudah) !== JSON.stringify(sebelum)) {
      const beda = sesudah.filter((n, i) => n !== sebelum[i]).slice(0, 3)
      throw new Error(`Nama field berubah setelah build: ${beda.join(', ')}`)
    }
    console.log(
      `OK round-trip nama field: ${sesudah.length} field utuh setelah build.`,
    )
  } finally {
    await db.execute(sql`DELETE FROM form_versions WHERE id = ${draft}`)
  }
}

/**
 * Menerbitkan revisi definisi tidak boleh menyembunyikan record yang sudah ada.
 *
 * Record menempel ke `surveys.formVersionId` saat dibuat, jadi kalau pembacaan
 * record hanya looking versi published terbaru, penerbitan versi baru akan
 * mengosongkan rekap. Ini skenario yang paling merusak kalau sampai salah.
 */
async function ujiTerbitkanVersiBaru(): Promise<void> {
  const snapshot = await snapshotVersiKunjunganRumah()
  const formId = (
    await db.execute(
      sql`SELECT id FROM forms WHERE kode = ${KODE_FORM_BAWAAN.kunjunganRumah}`,
    )
  )[0] as { id: number }
  const sebelum = await listKunjunganRumahRecords()

  try {
    const draft = await buatDraftBerikutnya(formId.id)
    await terbitkanVersiForm(draft)

    const sesudah = await listKunjunganRumahRecords()
    if (sesudah.length !== sebelum.length) {
      throw new Error(
        `Record hilang setelah penerbitan versi baru: ${sebelum.length} → ${sesudah.length}.`,
      )
    }
    console.log(
      `OK terbitkan versi baru: ${sesudah.length} record tetap terdaftar.`,
    )
  } finally {
    await pulihkanVersiKunjunganRumah(snapshot)
    const sekarang = await snapshotVersiKunjunganRumah()
    if (JSON.stringify(sekarang) !== JSON.stringify(snapshot)) {
      throw new Error(
        `Pemulihan versi gagal: diharapkan ${JSON.stringify(snapshot)}, sekarang ${JSON.stringify(sekarang)}`,
      )
    }
  }
}

/**
 * Record lama — yang menempel ke versi yang sudah diarsipkan — masih harus bisa
 * dibuka dan diperbarui setelah definisi form direvisi.
 */
async function ujiUpdateRecordVersiLama(): Promise<void> {
  const daftar = await listKunjunganRumahRecords()
  if (daftar.length === 0) return // tidak ada record untuk diuji
  const target = daftar[0] as { id: string }

  const sebelum = await getKunjunganRumahRecord(target.id)
  const hasil = await updateKunjunganRumahRecord(target.id, {
    ...(sebelum as object),
  })
  if (String((hasil as { id?: unknown }).id) !== target.id) {
    throw new Error('Update record lama mengembalikan id yang salah.')
  }
  const sesudah = await getKunjunganRumahRecord(target.id)
  if (JSON.stringify(sesudah) !== JSON.stringify(sebelum)) {
    throw new Error(
      'Isi record berubah setelah update dengan payload yang sama.',
    )
  }
  console.log('OK update record versi lama: isi tetap sama.')
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
