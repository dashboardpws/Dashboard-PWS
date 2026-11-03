import { useMemo } from 'react'
import { X } from 'lucide-react'
import { ChipGroup } from '@/components/ui/ChipGroup'
import { Checkbox } from '@/components/ui/Checkbox'
import { PRIOS } from '@/lib/constants'
import { fieldSasaranAktif } from '@/lib/service/kunjungan-rumah/conditional'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type {
  KunjunganRumahAction,
  KunjunganRumahState,
} from '@/lib/kunjungan-rumah/store/kunjungan-rumah-reducer'
import type { PenilaianForm } from '@/lib/kunjungan-rumah/models'
import { FieldCell } from './FieldCell'

interface Props {
  p: PenilaianForm
  state: KunjunganRumahState
  templates: KunjunganRumahTemplates
  dispatch: React.Dispatch<KunjunganRumahAction>
}

const TBC_SHARED_IDS = new Set([
  'paraf',
  'edukasiNakesMateri',
  'edukasiNakesTanggal',
  'laporNakesTanggal',
  'merokok',
])

function spanClass(columns: number | undefined): string {
  if (columns === 3) return 'sm:col-span-2 lg:col-span-3'
  if (columns === 2) return 'sm:col-span-2'
  return ''
}

export function SasaranForm({ p, state, templates, dispatch }: Props) {
  const tpl = templates.sasaran[p.sasaran]
  const fields = useMemo(
    () =>
      tpl.fields
        .filter((field) => field.active)
        .sort((a, b) => a.order - b.order),
    [tpl.fields],
  )
  const visibleIds = useMemo(
    () => fieldSasaranAktif(fields, p.values, p.checks),
    [fields, p.values, p.checks],
  )
  const visibleFields = useMemo(
    () => fields.filter((field) => visibleIds.has(field.id)),
    [fields, visibleIds],
  )
  const mergedTbc = useMemo(() => {
    if (p.sasaran === 'tbc' || !p.prioritas.includes('TB')) return []
    const ownIds = new Set(fields.map((field) => field.id))
    return templates.sasaran.tbc.fields.filter(
      (field) =>
        field.active &&
        field.section !== 'sasaran:identitas' &&
        !TBC_SHARED_IDS.has(field.id) &&
        !ownIds.has(field.id),
    )
  }, [p.sasaran, p.prioritas, fields, templates.sasaran.tbc.fields])
  const mergedTbcVisible = useMemo(
    () => fieldSasaranAktif(mergedTbc, p.values, p.checks),
    [mergedTbc, p.values, p.checks],
  )

  const renderValue = (field: (typeof fields)[number]) => (
    <div key={field.id} className={spanClass(field.columns)}>
      <FieldCell
        field={field}
        value={p.values[field.id] ?? ''}
        invalid={!!state.invalid[`${p.id}:${field.id}`]}
        onChange={(value) =>
          dispatch({ type: 'SET_VALUE', id: p.id, key: field.id, value })
        }
      />
    </div>
  )

  const renderChecks = (items: typeof fields, isBaha = false) =>
    items.map((field) => (
      <label
        key={field.id}
        className="flex cursor-pointer items-center gap-2 text-[13px]"
      >
        <Checkbox
          checked={p.checks[field.id] ?? false}
          onChange={(event) =>
            dispatch({
              type: 'SET_CHECK',
              id: p.id,
              key: field.id,
              checked: event.target.checked,
            })
          }
          className={
            isBaha && p.checks[field.id] ? '!border-danger-border' : ''
          }
          aria-label={field.label}
        />
        {field.label}
        {field.required ? <span className="text-danger">*</span> : null}
      </label>
    ))

  const groupFields = (bucket: string) => {
    const bucketFields = visibleFields.filter(
      (field) => field.section === bucket,
    )
    const groups = new Map<
      string,
      { label?: string; order: number; fields: typeof bucketFields }
    >()
    for (const group of tpl.layoutGroups) {
      groups.set(group.key, {
        label: group.label,
        order: group.order,
        fields: [],
      })
    }
    for (const field of bucketFields) {
      const key = field.layoutGroup ?? ''
      const group = groups.get(key)
      if (group) group.fields.push(field)
      else groups.set(key, { order: Number.MAX_SAFE_INTEGER, fields: [field] })
    }
    return [...groups.entries()]
      .filter(([, group]) => group.fields.length > 0)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, group]) => (
        <div key={key || 'tanpa-kelompok'} className="grid gap-2">
          {group.label ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {group.label}
            </span>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.fields.map(renderValue)}
          </div>
        </div>
      ))
  }

  const identitas = visibleFields.filter(
    (field) => field.section === 'sasaran:identitas',
  )
  const bools = visibleFields.filter(
    (field) => field.section === 'sasaran:bools',
  )
  const baha = visibleFields.filter((field) => field.section === 'sasaran:baha')
  const mergedValues = mergedTbc.filter(
    (field) =>
      field.section === 'sasaran:kolom' && mergedTbcVisible.has(field.id),
  )
  const mergedChecks = mergedTbc.filter(
    (field) =>
      (field.section === 'sasaran:bools' || field.section === 'sasaran:baha') &&
      mergedTbcVisible.has(field.id),
  )

  return (
    <div className="rounded-[10px] border border-accent bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-[13px]">{tpl.label}</b>
          <span className="text-[11px] text-muted">
            Anggota:{' '}
            {state.anggota.find((anggota) => anggota.id === p.anggotaId)
              ?.nama || '—'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_PENILAIAN', id: p.id })}
          className="text-muted hover:text-danger"
          aria-label="Hapus penilaian"
        >
          <X size={16} />
        </button>
      </div>

      {identitas.length > 0 ? (
        <div className="grid gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Identitas
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {identitas.map(renderValue)}
          </div>
        </div>
      ) : null}

      {groupFields('sasaran:kolom').length > 0 ? (
        <div className="mt-3 grid gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Isian sasaran
          </span>
          {groupFields('sasaran:kolom')}
        </div>
      ) : null}

      {bools.length > 0 ? (
        <div className="mt-3 grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Kondisi / pelayanan
          </span>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {renderChecks(bools)}
          </div>
        </div>
      ) : null}

      {baha.length > 0 ? (
        <div className="mt-3 grid gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              BaHa — tanda bahaya
            </span>
            <span className="text-[11px] text-muted">
              {baha.filter((field) => p.checks[field.id]).length}/{baha.length}{' '}
              ada
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
            {renderChecks(baha, true)}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Prioritas program
        </span>
        <ChipGroup
          options={PRIOS.map((prio) => ({ value: prio, label: prio }))}
          selected={p.prioritas}
          chipProps={{ size: 'sm' }}
          onToggle={(value) =>
            dispatch({ type: 'TOGGLE_PRIORITAS', id: p.id, prio: value })
          }
        />
      </div>

      {mergedTbc.length > 0 ? (
        <div className="mt-3 grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Pengendalian Penyakit Menular (TBC)
            </span>
            <span className="text-[11px] text-muted">
              prioritas program: TB
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mergedValues.map(renderValue)}
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {renderChecks(mergedChecks)}
          </div>
        </div>
      ) : null}
    </div>
  )
}
