import { describe, expect, it } from 'vitest'
import { cocokDenganForm, filterByForm, formIdOf } from './report-filter'
import type { BarisFormFilter } from './report-filter'
import type { SurveyRow } from '@/lib/api/server-fns'

const FORMS: BarisFormFilter[] = [
  { formId: 1, nama: 'Kunjungan Rumah RT', jumlahSubmit: 12 },
  { formId: 2, nama: 'KegiatanRt', jumlahSubmit: 3 },
]

function row(formNama: string): SurveyRow {
  return {
    id: '1',
    tanggal: '2026-07-15',
    nik: '3520010101990001',
    nama: 'Siti Aminah',
    nikKk: '3520010101990001',
    kelurahan: 'Kota Lama',
    petugas: 'Kader A',
    formNama,
    formKode: null,
    formVersion: 2,
  }
}

describe('formIdOf', () => {
  it('mengembalikan formId saat nama form cocok', () => {
    expect(formIdOf(row('Kunjungan Rumah RT'), FORMS)).toBe(1)
    expect(formIdOf(row('KegiatanRt'), FORMS)).toBe(2)
  })

  it('mengembalikan -1 saat nama form tidak ada di daftar', () => {
    expect(formIdOf(row('Form Yang Dihapus'), FORMS)).toBe(-1)
  })

  it('mengembalikan -1 saat daftar form kosong', () => {
    expect(formIdOf(row('Kunjungan Rumah RT'), [])).toBe(-1)
  })
})

/**
 * Regression: `formIdOf` pernah berupa `const` di dalam komponen `Laporan`,
 * dipanggil dari callback `useMemo` yang berada DI ATAS deklarasinya.
 * `useMemo` menjalankan factory-nya sinkron saat render, jadi memilih filter
 * form selain "Semua form" melempar
 * `ReferenceError: Cannot access 'formIdOf' before initialization`.
 * Default `formId = "all"` menutupi bug itu sampai user memilih form tertentu.
 *
 * Yang dikunci di sini adalah bentuk pemakaiannya: `filter` dengan `formId`
 * numerik harus menyaring tanpa melempar. Memindahkan helper kembali ke bawah
 * pemakaiannya tidak akan tertangkap test ini — yang menahan itu `tsc` dan review.
 */
describe('filter isian form per formId', () => {
  const rows = [
    row('Kunjungan Rumah RT'),
    row('KegiatanRt'),
    row('Form Tidak Dikenal'),
  ]

  it("formId 'all' membiarkan semua baris lewat", () => {
    expect(filterByForm(rows, 'all', FORMS)).toHaveLength(3)
  })

  it('formId numerik menyaring tanpa melempar', () => {
    expect(() => filterByForm(rows, 1, FORMS)).not.toThrow()
    expect(filterByForm(rows, 1, FORMS)).toHaveLength(1)
    expect(filterByForm(rows, 2, FORMS)).toHaveLength(1)
  })

  it('baris dengan form tak dikenal tersaring saat formId tertentu aktif', () => {
    // formIdOf mengembalikan -1, tidak boleh ikut lolos kalau user memilih form 1.
    const hasil = filterByForm(rows, 1, FORMS)
    expect(hasil.every((r) => r.formNama === 'Kunjungan Rumah RT')).toBe(true)
  })

  it('formId yang tidak ada mengembalikan 0 baris', () => {
    expect(filterByForm(rows, 999, FORMS)).toHaveLength(0)
  })

  it('predicate produksi dipakai langsung untuk semua dan form tertentu', () => {
    expect(cocokDenganForm(rows[0]!, 'all', FORMS)).toBe(true)
    expect(cocokDenganForm(rows[0]!, 1, FORMS)).toBe(true)
    expect(cocokDenganForm(rows[1]!, 1, FORMS)).toBe(false)
  })
})
