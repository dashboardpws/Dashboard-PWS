import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FormField } from '@/components/ui/FormField'
import type {
  KunjunganRumahAction,
  KunjunganRumahState,
} from '@/lib/kunjungan-rumah/store/kunjungan-rumah-reducer'

interface Props {
  state: KunjunganRumahState
  templates: KunjunganRumahTemplates
  dispatch: React.Dispatch<KunjunganRumahAction>
}

export function MasalahSection({ state, templates, dispatch }: Props) {
  const masalahFields = useMemo(
    () =>
      templates.masalah
        .filter((f) => f.active)
        .sort((a, b) => a.order - b.order),
    [templates.masalah],
  )

  // Sync otomatis: ikat ke anggota lewat id, aman untuk nama kembar.
  useEffect(() => {
    for (const m of state.masalah) {
      if (!m.anggotaId) continue
      const agg = state.anggota.find((a) => a.id === m.anggotaId)
      if (!agg) continue
      if (agg.nik !== m.nik)
        dispatch({
          type: 'UPDATE_MASALAH',
          id: m.id,
          key: 'nik',
          value: agg.nik,
        })
      if (agg.tglLahir !== m.tglLahir)
        dispatch({
          type: 'UPDATE_MASALAH',
          id: m.id,
          key: 'tglLahir',
          value: agg.tglLahir,
        })
      if (state.info.alamat !== m.alamat)
        dispatch({
          type: 'UPDATE_MASALAH',
          id: m.id,
          key: 'alamat',
          value: state.info.alamat,
        })
      if (state.info.hpKK !== m.telepon)
        dispatch({
          type: 'UPDATE_MASALAH',
          id: m.id,
          key: 'telepon',
          value: state.info.hpKK,
        })
    }
  }, [JSON.stringify(state.anggota), state.info.alamat, state.info.hpKK])

  return (
    <div className="mt-4 grid gap-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">
          Masalah & tindak lanjut <br className="sm:hidden" /> (per sasaran)
        </span>
        <Button
          variant="ghost"
          className="text-sm!"
          onClick={() => dispatch({ type: 'ADD_MASALAH' })}
        >
          + Tambah masalah
        </Button>
      </div>
      {state.invalid.masalahRequired ? (
        <span className="mb-1 block text-[11px] font-semibold text-danger">
          Masalah wajib diisi minimal 1 untuk sasaran yang dinilai.
        </span>
      ) : null}
      <div className="grid gap-3">
        {state.masalah.map((m) => (
          <div
            key={m.id}
            className="rounded-[10px] border border-line bg-surface p-3"
          >
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_MASALAH', id: m.id })}
                className="text-muted hover:text-danger"
                aria-label="Hapus masalah"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
              {masalahFields.map((f) => {
                const val = m[f.id] ?? ''
                const invalid = !!state.invalid[`masalah:${m.id}:${f.id}`]
                const errorId = `masalah:${m.id}:${f.id}-error`
                if (f.id === 'nama') {
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
                        value={m.anggotaId ?? ''}
                        onChange={(e) => {
                          const id = e.target.value
                          const agg = state.anggota.find((a) => a.id === id)
                          dispatch({
                            type: 'UPDATE_MASALAH',
                            id: m.id,
                            key: 'anggotaId',
                            value: id,
                          })
                          if (agg) {
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'nama',
                              value: agg.nama,
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'nik',
                              value: agg.nik,
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'tglLahir',
                              value: agg.tglLahir,
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'alamat',
                              value: state.info.alamat,
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'telepon',
                              value: state.info.hpKK,
                            })
                          } else {
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'nama',
                              value: '',
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'nik',
                              value: '',
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'tglLahir',
                              value: '',
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'alamat',
                              value: '',
                            })
                            dispatch({
                              type: 'UPDATE_MASALAH',
                              id: m.id,
                              key: 'telepon',
                              value: '',
                            })
                          }
                        }}
                        aria-describedby={invalid ? errorId : undefined}
                      >
                        <option value="">— Pilih anggota —</option>
                        {state.anggota.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nama}
                          </option>
                        ))}
                      </Select>
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
                    className={
                      f.id === 'masalah' || f.id === 'tindakLanjut'
                        ? 'col-span-2'
                        : ''
                    }
                    errorId={errorId}
                  >
                    {f.kind === 'date' ? (
                      <Input
                        type="date"
                        value={val}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_MASALAH',
                            id: m.id,
                            key: f.id,
                            value: e.target.value,
                          })
                        }
                        invalid={invalid}
                        aria-describedby={invalid ? errorId : undefined}
                      />
                    ) : f.kind === 'select' ? (
                      <Select
                        value={val}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_MASALAH',
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
                    ) : (
                      <Input
                        value={val}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_MASALAH',
                            id: m.id,
                            key: f.id,
                            value: e.target.value,
                          })
                        }
                        placeholder={
                          f.id === 'masalah'
                            ? 'cth. Hipertensi tidak patuh berobat'
                            : f.id === 'tindakLanjut'
                              ? 'cth. Edukasi & jadwal kontrol'
                              : ''
                        }
                        invalid={invalid}
                        aria-describedby={invalid ? errorId : undefined}
                      />
                    )}
                  </FormField>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
