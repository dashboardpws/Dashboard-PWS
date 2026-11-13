import { describe, expect, it } from 'vitest'
import { pesanFieldTerpakai } from './pesan-field-terpakai'

// Pesan ini murni: test tidak perlu memuat build.server atau DATABASE_URL.

describe('pesanFieldTerpakai', () => {
  const nama = (...pasangan: [string, string][]) => new Map(pasangan)

  it('sebutkan nama field dan jumlah isiannya', () => {
    const pesan = pesanFieldTerpakai(
      [{ fieldId: 'f1', total: 12 }],
      nama(['f1', 'tekanan_darah']),
    )
    expect(pesan).toContain('"tekanan_darah"')
    expect(pesan).toContain('12 isian')
    expect(pesan).toContain('tidak bisa dihapus')
  })

  it('jumlahkan isian dari semua field yang bermasalah', () => {
    const pesan = pesanFieldTerpakai(
      [
        { fieldId: 'f1', total: 3 },
        { fieldId: 'f2', total: 4 },
      ],
      nama(['f1', 'nik'], ['f2', 'nama']),
    )
    expect(pesan).toContain('7 isian')
  })

  it('potong daftar nama setelah tiga, tapi jumlah isian tetap utuh', () => {
    const dipakai = [
      { fieldId: 'f1', total: 1 },
      { fieldId: 'f2', total: 2 },
      { fieldId: 'f3', total: 3 },
      { fieldId: 'f4', total: 4 },
      { fieldId: 'f5', total: 5 },
    ]
    const pesan = pesanFieldTerpakai(
      dipakai,
      nama(['f1', 'a'], ['f2', 'b'], ['f3', 'c'], ['f4', 'd'], ['f5', 'e']),
    )
    expect(pesan).toContain('"a"')
    expect(pesan).toContain('"c"')
    expect(pesan).not.toContain('"d"')
    expect(pesan).toContain('dan 2 field lainnya')
    // 1+2+3+4+5 = 15, bukan hanya tiga yang disebut
    expect(pesan).toContain('15 isian')
  })

  it('pakai id field kalau nama tidak ketemu di peta', () => {
    const pesan = pesanFieldTerpakai([{ fieldId: 'f9', total: 2 }], new Map())
    expect(pesan).toContain('"f9"')
  })

  it('jangan sebut jumlah field lain kalau tepat tiga', () => {
    const pesan = pesanFieldTerpakai(
      [
        { fieldId: 'f1', total: 1 },
        { fieldId: 'f2', total: 1 },
        { fieldId: 'f3', total: 1 },
      ],
      nama(['f1', 'a'], ['f2', 'b'], ['f3', 'c']),
    )
    expect(pesan).not.toContain('field lainnya')
  })
})
