import { describe, expect, it } from 'vitest'
import {
  buildConditionalMap,
  fieldSasaranAktif,
  isConditionalActive,
} from './conditional'
import type { ConditionalRule } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'

const checksRule: ConditionalRule = {
  trigger: 'skriningJiwa',
  kind: 'checks',
  dependents: ['skriningJiwaTempat', 'skriningJiwaTanggal'],
}

const valueRule: ConditionalRule = {
  trigger: 'merokok',
  kind: 'values',
  when: 'Aktif',
  dependents: ['konselingBerhenti'],
}

const nonEmptyRule: ConditionalRule = {
  trigger: 'keluhan',
  kind: 'values',
  whenNonEmpty: true,
  dependents: ['keluhanDetail'],
}

describe('isConditionalActive', () => {
  it('checks kind mengikuti status centang', () => {
    expect(isConditionalActive(checksRule, {}, { skriningJiwa: true })).toBe(
      true,
    )
    expect(isConditionalActive(checksRule, {}, { skriningJiwa: false })).toBe(
      false,
    )
    expect(isConditionalActive(checksRule, {}, {})).toBe(false)
  })

  it('values kind cocok dengan when', () => {
    expect(isConditionalActive(valueRule, { merokok: 'Aktif' }, {})).toBe(true)
    expect(isConditionalActive(valueRule, { merokok: 'Pasif' }, {})).toBe(false)
    expect(isConditionalActive(valueRule, {}, {})).toBe(false)
  })

  it('whenNonEmpty true saat ada isi', () => {
    expect(isConditionalActive(nonEmptyRule, { keluhan: 'batuk' }, {})).toBe(
      true,
    )
    expect(isConditionalActive(nonEmptyRule, { keluhan: '   ' }, {})).toBe(
      false,
    )
    expect(isConditionalActive(nonEmptyRule, {}, {})).toBe(false)
  })
})

describe('buildConditionalMap', () => {
  it('petakan tiap dependent ke rule-nya', () => {
    const m = buildConditionalMap([checksRule, valueRule])
    expect(m.get('skriningJiwaTempat')).toBe(checksRule)
    expect(m.get('skriningJiwaTanggal')).toBe(checksRule)
    expect(m.get('konselingBerhenti')).toBe(valueRule)
    expect(m.get('tidak-ada')).toBeUndefined()
  })
})

describe('fieldSasaranAktif', () => {
  it('mengikuti visibility metadata dan tidak menghapus nilai field tersembunyi', () => {
    const fields = [
      {
        id: 'pemicu',
        label: 'Pemicu',
        kind: 'text' as const,
        section: 'sasaran:kolom',
        required: false,
        active: true,
        order: 0,
      },
      {
        id: 'detail',
        label: 'Detail',
        kind: 'text' as const,
        section: 'sasaran:kolom',
        required: true,
        active: true,
        order: 1,
        visibilityRules: [
          {
            id: 'rule-1',
            targetType: 'field' as const,
            targetId: 'detail',
            triggerFieldId: 'pemicu',
            operator: 'eq' as const,
            nilaiAcuan: 'Ya',
            aktif: true,
            urutan: 0,
          },
        ],
      },
    ]
    expect(fieldSasaranAktif(fields, { pemicu: 'Ya' }, {})).toEqual(
      new Set(['pemicu', 'detail']),
    )
    expect(fieldSasaranAktif(fields, { pemicu: 'Tidak' }, {})).toEqual(
      new Set(['pemicu']),
    )
  })
})
