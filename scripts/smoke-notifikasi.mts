/**
 * Cek ujung-ke-ujung sumber notifikasi terhadap database sungguhan.
 *
 * Semua tes unit berjalan di data buatan. Skrip ini memverifikasi hal yang tidak
 * bisa diuji di situ: query sumber berhasil, ID tetap terhubung dari record ke
 * warning, dan struktur hasil valid. Database tidak wajib punya warning tertentu;
 * database sehat tanpa jadwal terlambat tetap harus lulus.
 *
 * Semua sumber tetap diperiksa agar satu kegagalan tidak menyembunyikan kegagalan
 * lain, tetapi setiap kegagalan atau invarian yang rusak membuat exit code 1.
 *
 * Jalankan: pnpm db:smoke-notifikasi
 */
import { queryKelurahanStats } from '../src/lib/server/dashboard.server.ts'
import { listKunjunganRumahRecords } from '../src/lib/server/kunjungan-rumah.server.ts'
import { buildWarnings } from '../src/lib/dashboard/warning'
import {
  keVisitRecord,
  deriveJadwal,
  deriveTindakLanjutDari,
} from '../src/lib/notifikasi/sumber-warning'

const masalah: string[] = []
const periksa = (kondisi: boolean, pesan: string) => {
  if (!kondisi) masalah.push(pesan)
}

async function peta<T>(
  label: string,
  fn: () => Promise<T>,
  kosong: T,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const pesan = `[GAGAL] ${label}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
    console.log(pesan)
    masalah.push(pesan)
    return kosong
  }
}

const records = await peta(
  'listKunjunganRumahRecords',
  listKunjunganRumahRecords,
  [],
)
const kelurahan = await peta('queryKelurahanStats', queryKelurahanStats, [])

const visits = keVisitRecord(records)
const jadwal = deriveJadwal(visits)
const tindak = deriveTindakLanjutDari(visits)
const regions = kelurahan.map((k) => ({
  name: k.name,
  total: k.total,
  dikunjungi: k.dikunjungi,
}))

periksa(
  records.length === 0 || visits.length > 0,
  'Ada record kunjungan, tetapi tidak satu pun bisa dipetakan (id mungkin hilang).',
)
periksa(
  visits.length <= records.length,
  'Hasil mapping melebihi jumlah record.',
)
const visitIds = new Set(visits.map((v) => v.id))
periksa(visitIds.size === visits.length, 'ID visit hasil mapping tidak unik.')
periksa(
  visits.every((v) => v.id.length > 0),
  'Ada visit dengan ID kosong.',
)
periksa(
  jadwal.every((j) => visitIds.has(j.id)),
  'Ada jadwal yang tidak menunjuk visit sumber.',
)
periksa(
  tindak.every((t) => visitIds.has(t.id)),
  'Ada tindak lanjut yang tidak menunjuk visit sumber.',
)
periksa(
  regions.every(
    (r) =>
      r.name.length > 0 &&
      Number.isFinite(r.total) &&
      Number.isFinite(r.dikunjungi) &&
      r.total >= 0 &&
      r.dikunjungi >= 0,
  ),
  'Statistik kelurahan berisi nama atau angka yang tidak valid.',
)

const warnings = buildWarnings(
  { regions, jadwal, tindakLanjut: tindak },
  { now: new Date() },
)
periksa(
  warnings.every((w) => w.id.length > 0),
  'Ada warning dengan ID kosong.',
)
periksa(
  new Set(warnings.map((w) => w.id)).size === warnings.length,
  'ID warning tidak unik.',
)

console.log('--- sumber ---')
console.log('record kunjungan   :', records.length)
console.log('visit terpetakan   :', visits.length, 'dari', records.length)
console.log('  tanpa NIK        :', visits.filter((v) => !v.nik).length)
console.log('  tanpa tanggal    :', visits.filter((v) => !v.tanggal).length)
console.log('  tanpa hasil      :', visits.filter((v) => !v.hasil).length)
console.log('  jadwal terisi    :', visits.filter((v) => v.jadwal).length)
console.log('kelurahan          :', regions.length)
console.log('jadwal terbuka     :', jadwal.length)
console.log('tindak terbuka     :', tindak.length)

console.log('\n--- warning ---')
for (const w of warnings) {
  console.log(`[${w.severity}] ${w.type}: ${w.title}`)
}

const hitung = (t: string) => warnings.filter((w) => w.type === t).length
console.log(
  '\njadwal_terlambat muncul            :',
  hitung('jadwal_terlambat'),
)
console.log(
  'tindak_lanjut_belum_selesai muncul:',
  hitung('tindak_lanjut_belum_selesai'),
)

if (masalah.length > 0) {
  console.error(`\nSMOKE TEST GAGAL: ${masalah.length} masalah.`)
  for (const pesan of masalah) console.error(`- ${pesan}`)
  process.exit(1)
}
console.log('\nSMOKE TEST OK')
process.exit(0)
