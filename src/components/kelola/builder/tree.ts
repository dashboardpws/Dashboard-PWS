import type { DraftSection, DraftField, FlatNode } from './types'

export type { FlatNode } from './types'

/**
 * Kunci grup sortable untuk section. Section tidak punya anak, jadi semua
 * section berbagi satu grup dan urutannya datar.
 */
export const SECTION_GROUP = 'sections'

/**
 * Ubah draft form jadi daftar datar untuk ditampilkan di editor.
 *
 * Section tidak pernah punya anak, jadi hasilnya sederhana: setiap section
 * diikuti field-fieldnya, sesuai urutan input. Tidak ada pohon, tidak ada
 * tingkat kedalaman — urutan array sudah menentukan tampilan.
 */
/** Field yang section-nya tidak ada. Ditampilkan ikut warning, tidak dibuang. */
export function getOrphanFieldIds(
  sections: DraftSection[],
  fields: DraftField[],
): string[] {
  const ids = new Set(sections.map((s) => s.clientId))
  return fields
    .filter((f) => !ids.has(f.sectionClientId))
    .map((f) => f.clientId)
}

export function flattenDatar(
  sections: DraftSection[],
  fields: DraftField[],
): FlatNode[] {
  const fieldsBySection = new Map<string, DraftField[]>()
  for (const f of fields) {
    const list = fieldsBySection.get(f.sectionClientId) ?? []
    list.push(f)
    fieldsBySection.set(f.sectionClientId, list)
  }

  const flat: FlatNode[] = []
  // Identitas objek dipakai, bukan clientId: draft korup bisa punya field sah dan
  // orphan dengan clientId sama, dan keduanya tetap harus terlihat.
  const fieldsInFlat = new Set<DraftField>()
  let index = 0

  for (const s of sections) {
    flat.push({
      kind: 'section',
      clientId: s.clientId,
      parentKey: null,
      index: index++,
    })
    for (const f of fieldsBySection.get(s.clientId) ?? []) {
      fieldsInFlat.add(f)
      flat.push({
        kind: 'field',
        clientId: f.clientId,
        parentKey: s.clientId,
        index: index++,
      })
    }
  }

  // Field yang section-nya sudah tidak ada: tempel di akhir agar tidak hilang
  // diam-diam dan admin sempat melihatnya sebelum disimpan.
  const sectionIds = new Set(sections.map((s) => s.clientId))
  for (const f of fields) {
    if (!fieldsInFlat.has(f) && !sectionIds.has(f.sectionClientId)) {
      flat.push({
        kind: 'field',
        clientId: f.clientId,
        parentKey: null,
        index: index++,
      })
    }
  }

  return flat
}
