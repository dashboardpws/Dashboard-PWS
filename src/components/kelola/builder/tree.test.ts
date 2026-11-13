/**
 * Uji flatten draft Form Builder (`components/kelola/builder/tree.ts`).
 *
 * Dua aturan di sini yang paling mudah salah dan harus dikunci:
 *
 *   1. `index` harus berurutan tanpa celah dari 0. `@dnd-kit` memakai nilai ini
 *      sebagai urutan render. Begitu ada celah atau duplikat, urutan bisa tidak
 *      sama dengan urutan di database.
 *   2. Field yang section-nya sudah hilang tidak boleh dibuang. Field seperti
 *      ini ditempel di akhir dengan `parentKey: null` supaya admin sempat
 *      melihatnya sebelum menyimpan draft — menghapusnya diam-diam akan
 *      menghilangkan isian yang mungkin masih terpakai.
 */
import { describe, expect, it } from 'vitest'
import { flattenDatar, getOrphanFieldIds } from './tree'
import type { DraftField, DraftSection } from './types'

function section(clientId: string): DraftSection {
  return { clientId } as unknown as DraftSection
}

function field(clientId: string, sectionClientId: string): DraftField {
  return { clientId, sectionClientId } as unknown as DraftField
}

describe('getOrphanFieldIds', () => {
  it('tidak ada orphan saat semua field punya section yang ada', () => {
    const sections = [section('s1'), section('s2')]
    const fields = [field('f1', 's1'), field('f2', 's1'), field('f3', 's2')]
    expect(getOrphanFieldIds(sections, fields)).toEqual([])
  })

  it('menandai field yang section-nya tidak ada', () => {
    const sections = [section('s1')]
    const fields = [field('f1', 's1'), field('f2', 's-hilang')]
    expect(getOrphanFieldIds(sections, fields)).toEqual(['f2'])
  })

  it('mempertahankan urutan input', () => {
    const sections: DraftSection[] = []
    const fields = [field('f9', 'x'), field('f1', 'x'), field('f5', 'x')]
    expect(getOrphanFieldIds(sections, fields)).toEqual(['f9', 'f1', 'f5'])
  })

  it('section tanpa field tidak menghasilkan apa pun', () => {
    expect(getOrphanFieldIds([section('s1')], [])).toEqual([])
    expect(getOrphanFieldIds([], [])).toEqual([])
  })
})

describe('flattenDatar', () => {
  it('menyusun section lalu field-nya sesuai urutan input', () => {
    const sections = [section('s1'), section('s2')]
    const fields = [field('f1', 's1'), field('f2', 's1'), field('f3', 's2')]
    const flat = flattenDatar(sections, fields)

    expect(flat.map((n) => `${n.kind}:${n.clientId}`)).toEqual([
      'section:s1',
      'field:f1',
      'field:f2',
      'section:s2',
      'field:f3',
    ])
  })

  it('memberi index berurutan dari 0 tanpa celah', () => {
    const sections = [section('s1'), section('s2')]
    const fields = [field('f1', 's1'), field('f2', 's2')]
    const flat = flattenDatar(sections, fields)

    expect(flat.map((n) => n.index)).toEqual([0, 1, 2, 3])
  })

  it('section punya parentKey null, field punya parentKey section-nya', () => {
    const flat = flattenDatar([section('s1')], [field('f1', 's1')])
    const s1 = must(flat[0], 'node section')
    const f1 = must(flat[1], 'node field')
    expect(s1.kind).toBe('section')
    expect(s1.parentKey).toBeNull()
    expect(f1.kind).toBe('field')
    expect(f1.parentKey).toBe('s1')
  })

  it('section tanpa field tetap muncul', () => {
    const flat = flattenDatar([section('s1'), section('s2')], [])
    expect(flat.map((n) => n.clientId)).toEqual(['s1', 's2'])
    expect(flat.map((n) => n.kind)).toEqual(['section', 'section'])
  })

  it('field orphan ditempel di akhir dengan parentKey null, bukan dibuang', () => {
    const sections = [section('s1')]
    const fields = [
      field('f1', 's1'),
      field('yatim1', 's-hilang'),
      field('yatim2', 'lain'),
    ]
    const flat = flattenDatar(sections, fields)

    // Yang orphaned tetap ada, di belakang section yang sah.
    expect(flat.map((n) => n.clientId)).toEqual([
      's1',
      'f1',
      'yatim1',
      'yatim2',
    ])
    const yatim1 = must(flat[2], 'node orphan pertama')
    expect(yatim1.kind).toBe('field')
    expect(yatim1.parentKey).toBeNull()
    expect(yatim1.index).toBe(2)
  })

  it('semua field orphan saat tidak ada section sama sekali', () => {
    const fields = [field('f1', 's-hilang'), field('f2', 's-hilang2')]
    const flat = flattenDatar([], fields)
    expect(flat).toHaveLength(2)
    expect(flat.every((n) => n.kind === 'field' && n.parentKey === null)).toBe(
      true,
    )
    expect(flat.map((n) => n.index)).toEqual([0, 1])
  })

  it('daftar kosong menghasilkan daftar kosong', () => {
    expect(flattenDatar([], [])).toEqual([])
  })

  it('urutan field dalam satu section mengikuti urutan inputnya', () => {
    const sections = [section('s1')]
    const fields = [field('c', 's1'), field('a', 's1'), field('b', 's1')]
    const flat = flattenDatar(sections, fields)
    expect(
      flat.filter((n) => n.kind === 'field').map((n) => n.clientId),
    ).toEqual(['c', 'a', 'b'])
  })

  it('mempertahankan semua node saat clientId duplikat', () => {
    const flat = flattenDatar(
      [section('s1')],
      [field('f1', 's1'), field('f1', 's1')],
    )
    expect(flat).toEqual([
      { kind: 'section', clientId: 's1', parentKey: null, index: 0 },
      { kind: 'field', clientId: 'f1', parentKey: 's1', index: 1 },
      { kind: 'field', clientId: 'f1', parentKey: 's1', index: 2 },
    ])
  })

  it('tidak membuang orphan yang clientId-nya sama dengan field sah', () => {
    const flat = flattenDatar(
      [section('s1')],
      [field('f1', 's1'), field('f1', 's-hilang')],
    )
    expect(flat).toEqual([
      { kind: 'section', clientId: 's1', parentKey: null, index: 0 },
      { kind: 'field', clientId: 'f1', parentKey: 's1', index: 1 },
      { kind: 'field', clientId: 'f1', parentKey: null, index: 2 },
    ])
  })
})

/** Ambil satu node atau gagal keras. */
function must<T>(nilai: T | undefined, keterangan: string): T {
  if (nilai === undefined) throw new Error(`test: ${keterangan} tidak ada`)
  return nilai
}
