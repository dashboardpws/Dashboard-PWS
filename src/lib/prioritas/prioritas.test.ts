import { describe, expect, it } from 'vitest'
import {
  buatKodePrioritas,
  labelPrioritas,
  prioritasSistem,
  validasiNamaPrioritas,
} from './prioritas'

describe('prioritas', () => {
  const data = [
    { id: 1, kode: 'TB', nama: 'Tuberkulosis', urutan: 1, aktif: true },
  ]

  it('memakai nama baru dan fallback ke kode', () => {
    expect(labelPrioritas('TB', data)).toBe('Tuberkulosis')
    expect(labelPrioritas('LAMA', data)).toBe('LAMA')
  })

  it('membuat kode unik dan mengenali prioritas sistem', () => {
    expect(buatKodePrioritas('TB', data)).toBe('TB_2')
    expect(prioritasSistem('TB')).toBe(true)
    expect(prioritasSistem('ODGJ')).toBe(false)
  })

  it('memvalidasi nama wajib dan panjang', () => {
    expect(validasiNamaPrioritas(' ')).not.toBeNull()
    expect(validasiNamaPrioritas('Sehat')).toBeNull()
    expect(validasiNamaPrioritas('x'.repeat(51))).not.toBeNull()
  })
})
