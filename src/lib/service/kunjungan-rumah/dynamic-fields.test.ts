import { describe, expect, it } from 'vitest'
import type { KunjunganRumahTemplateField } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import { validInput } from './kunjungan-rumah.fixture'
import { computeFillPercent } from './progress'
import { validateKunjunganRumah } from './validate-kunjungan-rumah'

function field(
  overrides: Partial<KunjunganRumahTemplateField> = {},
): KunjunganRumahTemplateField {
  return {
    id: 'catatan',
    label: 'Catatan',
    kind: 'text',
    section: 'tambahan',
    active: true,
    required: true,
    order: 0,
    ...overrides,
  }
}

describe('field dinamis pada validasi dan progres', () => {
  it.each([
    {
      kind: 'text' as const,
      options: undefined,
      kosong: '  ',
      isi: 'Catatan kader',
    },
    {
      kind: 'checkbox' as const,
      options: undefined,
      kosong: 'false',
      isi: 'true',
    },
    {
      kind: 'checkbox' as const,
      options: ['A', 'B'],
      kosong: '[]',
      isi: '["A"]',
    },
    {
      kind: 'checkbox' as const,
      options: ['A'],
      kosong: 'rusak',
      isi: '["A"]',
    },
  ])(
    'menagih $kind dengan nilai $kosong dan menerima $isi',
    ({ kind, options, kosong, isi }) => {
      const input = validInput()
      input.templates.sections.push({
        name: 'tambahan',
        label: 'Tambahan',
        description: null,
        kind: 'form_generik',
        order: 99,
        active: true,
        layoutGroups: [],
        fields: [field({ kind, options })],
      })
      input.tambahan = { 'tambahan::catatan': kosong }
      expect(validateKunjunganRumah(input)).toEqual({
        ok: false,
        invalid: { 'tambahan::catatan': true },
      })
      const sebelum = computeFillPercent(input)
      expect(sebelum).toBeLessThan(100)
      input.tambahan['tambahan::catatan'] = isi
      expect(validateKunjunganRumah(input)).toEqual({ ok: true, invalid: {} })
      expect(computeFillPercent(input)).toBe(100)
    },
  )

  it.each(['section', 'field', 'optional'])(
    'mengabaikan field kosong ketika %s tidak ditagih',
    (mode) => {
      const input = validInput()
      input.templates.sections.push({
        name: 'tambahan',
        label: 'Tambahan',
        description: null,
        kind: 'form_generik',
        order: 99,
        active: mode !== 'section',
        layoutGroups: [],
        fields: [
          field({ active: mode !== 'field', required: mode !== 'optional' }),
        ],
      })
      expect(validateKunjunganRumah(input)).toEqual({ ok: true, invalid: {} })
      expect(computeFillPercent(input)).toBe(100)
    },
  )

  it.each([false, true])(
    'menagih field sasaran wajib hanya ketika terlihat=%s',
    (terlihat) => {
      const input = validInput()
      input.templates.sasaran.dewasa.fields = [
        field({ id: 'pemicu', required: false }),
        field({
          visibilityRules: [
            {
              id: 'vis',
              targetType: 'field',
              targetId: 'catatan',
              triggerFieldId: 'pemicu',
              operator: 'eq',
              nilaiAcuan: 'Ya',
              aktif: true,
              urutan: 0,
            },
          ],
        }),
      ]
      input.penilaian[0]!.values.pemicu = terlihat ? 'Ya' : 'Tidak'
      expect(validateKunjunganRumah(input)).toEqual({
        ok: !terlihat,
        invalid: terlihat ? { 'p1:catatan': true } : {},
      })
      expect(computeFillPercent(input) === 100).toBe(!terlihat)
      input.penilaian[0]!.values.catatan = 'Sudah diperiksa'
      expect(validateKunjunganRumah(input).ok).toBe(true)
      expect(computeFillPercent(input)).toBe(100)
    },
  )

  it('menolak petugas kosong dengan kunci error yang ditampilkan form', () => {
    const input = validInput()
    input.info.petugasId = ' '
    expect(validateKunjunganRumah(input)).toEqual({
      ok: false,
      invalid: { petugasId: true },
    })
  })
})
