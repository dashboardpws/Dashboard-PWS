import { describe, expect, it } from 'vitest'
import { refSasaranValid } from './ref'

describe('refSasaranValid', () => {
  it('menerima UUID v4 yang dipakai public_id', () => {
    expect(refSasaranValid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true)
    expect(refSasaranValid('  3F2504E0-4F89-41D3-9A0C-0305E82C3301  ')).toBe(
      true,
    )
  })

  it('menolak NIK dan teks yang mirip NIK', () => {
    expect(refSasaranValid('3201010101010001')).toBe(false)
    expect(refSasaranValid('0000000000000123')).toBe(false)
  })

  it('menolak UUID yang terpotong atau berisi karakter lain', () => {
    expect(refSasaranValid('3f2504e0-4f89-41d3-9a0c')).toBe(false)
    expect(refSasaranValid('3f2504e0-4f89-41d3-9a0c-0305e82c330z')).toBe(false)
    expect(refSasaranValid('')).toBe(false)
  })
})
