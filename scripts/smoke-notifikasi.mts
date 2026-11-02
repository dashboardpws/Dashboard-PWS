/**
 * Cek ujung-ke-ujung sumber notifikasi terhadap database sungguhan.
 *
 * Semua tes unit berjalan di data buatan. Skrip ini memverifikasi hal yang tidak
 * bisa diuji di situ: apakah `listKunjunganRumahRecords()` benar-benar
 * mengembalikan payload dengan `info.nik` / `jadwal` / `hasil`, sehingga
 * `jadwal_terlambat` dan `tindak_lanjut_belum_selesai` bisa muncul di aplikasi.
 *
 * Setiap sumber dicek sendiri-sendiri dan gagalnya dilaporkan, tidak dilempar —
 * database lokal sering tertinggal dari migrasi (`survey_entries` pernah belum
 * ada) dan skrip ini harus tetap berguna untuk hal yang lain.
 *
 * Jalankan: npx tsx scripts/smoke-notifikasi.mts
 */
import { queryKelurahanStats } from '../src/lib/server/dashboard.server.ts'
import { listKunjunganRumahRecords } from '../src/lib/server/kunjungan-rumah.server.ts'
import { buildWarnings } from '../src/lib/dashboard/warning'
import {
  keVisitRecord,
  deriveJadwal,
  deriveTindakLanjutDari,
} from '../src/lib/notifikasi/sumber-warning'

async function peta<T>(
  label: string,
  fn: () => Promise<T>,
  kosong: T,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.log(
      `[GAGAL] ${label}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`,
    )
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

const warnings = buildWarnings(
  { regions, jadwal, tindakLanjut: tindak },
  { now: new Date() },
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

process.exit(0)
