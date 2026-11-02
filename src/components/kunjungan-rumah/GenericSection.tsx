import { useMemo } from 'react'
import type { KunjunganRumahSectionTemplate } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type {
  KunjunganRumahAction,
  KunjunganRumahState,
} from '@/lib/kunjungan-rumah/store/kunjungan-rumah-reducer'
import { FieldCell } from './FieldCell'

/**
 * Renderer section generik dari Form Builder.
 *
 * Nilainya disimpan di `state.tambahan` dengan kunci `${section}::${fieldId}`,
 * bukan di `info`/`sanitasi`. Namespace itu mencegah field baru menimpa isian
 * bawaan yang kebetulan bernama sama, dan membuat record lama tetap terbaca.
 *
 * Pengelompokan memakai `layoutGroups` + `field.layoutGroup` yang eksplisit di
 * schema. Tidak ada tebakan dari nama field: label kelompok dan urutannya datang
 * dari definisi form, jadi admin bisa mengubahnya tanpa menyentuh kode.
 */
export function GenericSection({
  section,
  state,
  dispatch,
}: {
  section: KunjunganRumahSectionTemplate
  state: KunjunganRumahState
  dispatch: React.Dispatch<KunjunganRumahAction>
}) {
  const fields = useMemo(
    () =>
      section.fields.filter((f) => f.active).sort((a, b) => a.order - b.order),
    [section.fields],
  )

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { label: string | null; order: number; fields: typeof fields }
    >()
    for (const g of section.layoutGroups) {
      map.set(g.key, { label: g.label, order: g.order, fields: [] })
    }
    for (const f of fields) {
      const key = f.layoutGroup ?? ''
      const entry = map.get(key)
      if (entry) entry.fields.push(f)
      else
        map.set(key, {
          label: null,
          order: Number.MAX_SAFE_INTEGER,
          fields: [f],
        })
    }
    return [...map.values()]
      .filter((g) => g.fields.length > 0)
      .sort((a, b) => a.order - b.order)
  }, [fields, section.layoutGroups])

  return (
    <div className="grid gap-4">
      {groups.map((group, index) => (
        <div
          key={`${group.label ?? 'tanpa-kelompok'}-${index}`}
          className="grid gap-2"
        >
          {group.label ? (
            <span className="text-xs font-semibold text-ink">
              {group.label}
            </span>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.fields.map((field) => {
              const key = `${section.name}::${field.id}`
              const span = Math.min(3, Math.max(1, field.columns ?? 1))
              const spanClass =
                span === 3
                  ? 'sm:col-span-2 lg:col-span-3'
                  : span === 2
                    ? 'sm:col-span-2'
                    : ''
              return (
                <div key={field.id} className={spanClass}>
                  <FieldCell
                    field={field}
                    value={state.tambahan[key] ?? ''}
                    invalid={!!state.invalid[key]}
                    onChange={(value) =>
                      dispatch({ type: 'SET_TAMBAHAN_FIELD', key, value })
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
