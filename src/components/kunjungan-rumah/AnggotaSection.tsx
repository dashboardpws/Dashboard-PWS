import { useMemo } from 'react'
import { X } from 'lucide-react'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type { SasaranKey } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ChipGroup } from '@/components/ui/ChipGroup'
import { FormField } from '@/components/ui/FormField'
import type {
  KunjunganRumahAction,
  KunjunganRumahState,
} from '@/lib/kunjungan-rumah/store/kunjungan-rumah-reducer'
import { normalkanNik } from '@/lib/utils'

interface Props {
  state: KunjunganRumahState
  templates: KunjunganRumahTemplates
  dispatch: React.Dispatch<KunjunganRumahAction>
}

const SASARAN_LABEL_SHORT: Partial<Record<SasaranKey, string>> = {
  'bersalin-nifas': 'Bersalin & Nifas',
  balita: 'Balita 6–71 bulan',
  remaja: 'Remaja 6–18 tahun',
  dewasa: 'Dewasa',
  lansia: 'Lansia',
}

export function AnggotaSection({ state, templates, dispatch }: Props) {
  const anggotaFields = useMemo(
    () =>
      templates.anggota
        .filter((f) => f.active)
        .sort((a, b) => a.order - b.order),
    [templates.anggota],
  )

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">
          Anggota keluarga <span className="text-danger">*</span>
          <span className="ml-2 font-normal text-muted">
            jumlah: {state.anggota.length}
          </span>
        </span>
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: 'ADD_ANGGOTA' })}
        >
          + Tambah anggota
        </Button>
      </div>
      {state.invalid.anggota ? (
        <span className="mt-1 block text-[11px] font-semibold text-danger">
          Minimal 1 anggota keluarga.
        </span>
      ) : null}
      <div className="grid gap-3">
        {state.anggota.map((m, i) => {
          const memberPeni = state.penilaian.filter((p) => p.anggotaId === m.id)
          return (
            <div
              key={m.id}
              className="rounded-[10px] border border-accent bg-surface p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-ink">
                  Anggota {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'REMOVE_ANGGOTA', id: m.id })}
                  className="text-muted hover:text-danger"
                  aria-label="Hapus anggota"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
                {anggotaFields.map((f) => {
                  const val = m[f.id] ?? ''
                  const invalid = !!state.invalid[`${f.id}:${m.id}`]
                  const errorId = `${f.id}:${m.id}-error`
                  if (f.id === 'nik') {
                    return (
                      <FormField
                        key={f.id}
                        label={f.label}
                        required={f.required}
                        invalid={invalid}
                        error={
                          f.required ? 'Wajib 16 digit & unik.' : undefined
                        }
                        errorId={errorId}
                      >
                        <Input
                          value={val}
                          onChange={(e) =>
                            dispatch({
                              type: 'UPDATE_ANGGOTA',
                              id: m.id,
                              key: f.id,
                              value: normalkanNik(e.target.value),
                            })
                          }
                          inputMode="numeric"
                          placeholder="3579…………"
                          invalid={invalid}
                          aria-describedby={invalid ? errorId : undefined}
                        />
                      </FormField>
                    )
                  }
                  if (f.kind === 'select') {
                    return (
                      <FormField
                        key={f.id}
                        label={f.label}
                        required={f.required}
                        invalid={invalid}
                        error="Wajib diisi."
                        hint={f.hint}
                        errorId={errorId}
                      >
                        <Select
                          value={val}
                          onChange={(e) =>
                            dispatch({
                              type: 'UPDATE_ANGGOTA',
                              id: m.id,
                              key: f.id,
                              value: e.target.value,
                            })
                          }
                          aria-describedby={invalid ? errorId : undefined}
                        >
                          <option value="">— Pilih —</option>
                          {(f.options ?? []).map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </Select>
                      </FormField>
                    )
                  }
                  if (f.kind === 'date') {
                    return (
                      <FormField
                        key={f.id}
                        label={f.label}
                        required={f.required}
                        invalid={invalid}
                        error="Wajib diisi."
                        hint={f.hint}
                        errorId={errorId}
                      >
                        <Input
                          type="date"
                          value={val}
                          onChange={(e) =>
                            dispatch({
                              type: 'UPDATE_ANGGOTA',
                              id: m.id,
                              key: f.id,
                              value: e.target.value,
                            })
                          }
                          invalid={invalid}
                          aria-describedby={invalid ? errorId : undefined}
                        />
                      </FormField>
                    )
                  }
                  return (
                    <FormField
                      key={f.id}
                      label={f.label}
                      required={f.required}
                      invalid={invalid}
                      error="Wajib diisi."
                      hint={f.hint}
                      errorId={errorId}
                    >
                      <Input
                        value={val}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_ANGGOTA',
                            id: m.id,
                            key: f.id,
                            value: e.target.value,
                          })
                        }
                        placeholder={
                          f.id === 'nama' ? 'cth. Budi Setiawan' : ''
                        }
                        invalid={invalid}
                        aria-describedby={invalid ? errorId : undefined}
                      />
                    </FormField>
                  )
                })}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink">
                  Sasaran yang diperiksa <span className="text-danger">*</span>
                  <span className="ml-auto font-normal text-muted">
                    {memberPeni.length} penilaian
                  </span>
                </div>
                <ChipGroup
                  options={Object.entries(templates.sasaran)
                    .filter(([key]) => key !== 'tbc')
                    .map(([key, tpl]) => ({
                      value: key,
                      label:
                        SASARAN_LABEL_SHORT[key as SasaranKey] ?? tpl.label,
                    }))}
                  selected={memberPeni.map((p) => p.sasaran)}
                  chipProps={{ size: 'sm' }}
                  onToggle={(v) => {
                    const key = v as SasaranKey
                    const current = memberPeni[0]
                    if (current && current.sasaran === key)
                      dispatch({ type: 'REMOVE_PENILAIAN', id: current.id })
                    else
                      dispatch({
                        type: 'GANTI_SASARAN',
                        anggotaId: m.id,
                        sasaran: key,
                        templates,
                      })
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {state.invalid.penilaian ? (
        <span className="mt-2 block text-[11px] font-semibold text-danger">
          Pilih minimal 1 sasaran untuk diperiksa.
        </span>
      ) : null}
    </div>
  )
}
