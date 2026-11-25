import { describe, expect, it } from 'vitest'
import { TANPA_NILAI, barisGroup, formatNilaiJawaban } from './format-jawaban'

const OPSI = [
  { value: 'ya', label: 'Ya' },
  { value: 'tidak', label: null },
  { value: 'lain', label: 'Lainnya' },
]

function format(tipe: string, value: unknown, opsi = OPSI) {
  return formatNilaiJawaban({ tipe, value, opsi })
}

describe('formatNilaiJawaban: teks dan angka', () => {
  it('teks biasa dikembalikan apa adanya', () => {
    expect(format('text', 'Budi').teks).toBe('Budi')
  })

  it('teks panjang tidak dipotong', () => {
    expect(format('textarea', 'a\nb').teks).toBe('a\nb')
  })

  it('angka jadi teks biasa', () => {
    expect(format('number', 72).teks).toBe('72')
  })

  it('angka 0 bukan kosong', () => {
    expect(format('number', 0)).toEqual({ teks: '0', kosong: false })
  })

  it('angka null kosong', () => {
    expect(format('number', null)).toEqual({ teks: TANPA_NILAI, kosong: true })
  })

  it('tanggal dan waktu jadi string YYYY-MM-DD / HH:MM', () => {
    expect(format('date', '2026-03-04').teks).toBe('2026-03-04')
    expect(format('time', '09:15').teks).toBe('09:15')
  })

  it("string kosong ditandai kosong, bukan teks '—' dengan isi", () => {
    expect(format('text', '')).toEqual({ teks: '', kosong: true })
  })

  it('undefined dan null kosong', () => {
    expect(format('text', undefined).kosong).toBe(true)
    expect(format('text', null).kosong).toBe(true)
  })

  it('boolean ditampilkan sebagai teks', () => {
    expect(format('text', true).teks).toBe('true')
  })
})

describe('formatNilaiJawaban: pilihan', () => {
  it('select dipetakan ke label opsi', () => {
    expect(format('select', 'ya').teks).toBe('Ya')
  })

  it('opsi tanpa label jatuh ke value', () => {
    expect(format('radio', 'tidak').teks).toBe('tidak')
  })

  it('value yang tidak ada di daftar opsi tetap ditampilkan', () => {
    expect(format('select', 'hilang').teks).toBe('hilang')
  })

  it('select kosong berarti belum diisi', () => {
    expect(format('select', null).kosong).toBe(true)
  })

  it('checkbox banyak dipetakan berurutan', () => {
    expect(format('checkbox', ['ya', 'lain']).teks).toBe('Ya, Lainnya')
  })

  it('checkbox array kosong sah tapi berarti belum diisi', () => {
    expect(format('checkbox', [])).toEqual({ teks: TANPA_NILAI, kosong: true })
  })

  it('checkbox mengabaikan entri non-teks', () => {
    expect(format('checkbox', ['ya', 3, null]).teks).toBe('Ya')
  })

  it('select tanpa daftar opsi tetap menampilkan value', () => {
    expect(formatNilaiJawaban({ tipe: 'select', value: 'ya' }).teks).toBe('ya')
  })
})

describe('formatNilaiJawaban: group dan lampiran', () => {
  it('group diratakan dengan nomor kolom', () => {
    const hasil = format('group', [{ kolom1: 'Andi', kolom2: 'Budi' }])
    expect(hasil.teks).toBe('Kolom 1: Andi · Kolom 2: Budi')
  })

  it('group dengan kolom10 diurutkan setelah kolom2', () => {
    expect(barisGroup([{ kolom10: 'sepuluh', kolom2: 'dua' }])).toEqual([
      { kolom: 2, nilai: 'dua' },
      { kolom: 10, nilai: 'sepuluh' },
    ])
  })

  it('group mengabaikan kunci yang bukan kolom', () => {
    expect(barisGroup([{ kolom1: 'satu', nama: 'bukan kolom' }])).toEqual([
      { kolom: 1, nilai: 'satu' },
    ])
  })

  it('group bukan array kosong', () => {
    expect(barisGroup('bukan array')).toEqual([])
    expect(barisGroup([1, 'dua', null])).toEqual([])
  })

  it('group kosong berarti belum diisi', () => {
    expect(format('group', []).kosong).toBe(true)
  })

  it('group beberapa baris digabung', () => {
    expect(format('group', [{ kolom1: 'A' }, { kolom1: 'B' }]).teks).toBe(
      'Kolom 1: A · Kolom 1: B',
    )
  })

  it('image kosong berarti belum diisi', () => {
    expect(format('image', null)).toEqual({ teks: TANPA_NILAI, kosong: true })
    expect(format('image', [])).toEqual({ teks: TANPA_NILAI, kosong: true })
  })

  it('image menampilkan jumlah foto', () => {
    const hasil = format('image', [
      { name: 'a.jpg', path: 'form/a.jpg' },
      { name: 'b.jpg', path: 'form/b.jpg' },
    ])
    expect(hasil).toEqual({ teks: '2 foto terlampir', kosong: false })
  })

  it('file belum didukung', () => {
    expect(format('file', null)).toEqual({ teks: TANPA_NILAI, kosong: true })
  })
})

describe('formatNilaiJawaban: nilai tak terduga', () => {
  it('objek tak dikenal diserialisasi, tidak dilempar', () => {
    expect(format('text', { a: 1 }).teks).toBe('{"a":1}')
  })

  it('tipe tak dikenal tetap punya teks', () => {
    expect(format('misterius', 'apa saja').teks).toBe('apa saja')
  })
})
