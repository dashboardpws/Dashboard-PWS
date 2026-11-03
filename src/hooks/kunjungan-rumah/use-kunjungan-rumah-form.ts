import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useKunjunganRumahTemplates } from './use-kunjungan-rumah-templates'
import { useKunjunganRumahRecords } from './use-kunjungan-rumah-records'
import { useToast } from '@/providers/toast'
import { prepareFotos } from '@/lib/kunjungan-rumah/fotos'
import { StorageUploadError, uploadDataUrl } from '@/lib/supabase-storage'
import { validateKunjunganRumah } from '@/lib/service/kunjungan-rumah/validate-kunjungan-rumah'
import {
  initialKunjunganRumahState,
  kunjunganRumahReducer,
} from '@/lib/kunjungan-rumah/store/kunjungan-rumah-reducer'
import {
  selectBahaCount,
  selectFillPercent,
  selectStepState,
} from '@/lib/kunjungan-rumah/store/kunjungan-rumah-selectors'
import {
  KUNJUNGAN_RUMAH_SCHEMA_VERSION,
  createRecordId,
} from '@/lib/kunjungan-rumah/types'
import type { KunjunganRumahRecord } from '@/lib/kunjungan-rumah/types'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'
import {
  buatKrFieldBindings,
  bersihkanFieldTersembunyiKR,
  evaluasiVisibilitasKR,
  templateTerlihatKR,
  terapkanAutofillKeStateKR,
} from '@/lib/kunjungan-rumah/kr-state-bridge'

export interface UseKunjunganRumahFormOptions {
  /** Record yang sedang diedit. Saat diberikan, submit memperbarui record ini (bukan menambah baru). */
  record?: KunjunganRumahRecord | null
}

export function useKunjunganRumahForm(opts?: UseKunjunganRumahFormOptions) {
  const {
    templates: templatesDasar,
    rulesAutofill,
    rulesVisibilitas,
  } = useKunjunganRumahTemplates()
  const toast = useToast()
  const record = opts?.record ?? null
  const editingId = record?.id ?? null
  const [state, dispatch] = useReducer(kunjunganRumahReducer, undefined, () => {
    const s = initialKunjunganRumahState()
    const first = templatesDasar.hasilOpsi[0]
    if (first && s.hasil !== first) s.hasil = first
    return s
  })
  const bindings = useMemo(
    () => buatKrFieldBindings(templatesDasar),
    [templatesDasar],
  )
  const visibilitas = useMemo(
    () => evaluasiVisibilitasKR({ state, bindings, rules: rulesVisibilitas }),
    [state, bindings, rulesVisibilitas],
  )
  const templates = useMemo(
    () => templateTerlihatKR(templatesDasar, visibilitas, bindings),
    [templatesDasar, visibilitas, bindings],
  )
  // Sumber tunggal: Postgres via server fn. Tanpa localStorage.
  const {
    records,
    loading: recordsLoading,
    error: recordsError,
    saveRecord,
    updateRecord,
    removeRecord: removeDbRecord,
  } = useKunjunganRumahRecords()
  const [fotoUploading, setFotoUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const hasil = bersihkanFieldTersembunyiKR({
      state,
      bindings,
      visibilitas,
    })
    if (hasil.changed) dispatch({ type: 'REPLACE_STATE', state: hasil.state })
  }, [state, bindings, visibilitas])

  const handleWargaSelected = useCallback(
    (row: SasaranSuggestion) => {
      const stateKosong = kunjunganRumahReducer(state, {
        type: 'RESET_DATA_SASARAN',
      })
      const stateWithWarga = kunjunganRumahReducer(stateKosong, {
        type: 'APPLY_SASARAN',
        row,
      })
      const hasilAutofill = terapkanAutofillKeStateKR({
        state: stateWithWarga,
        bindings,
        rules: rulesAutofill,
        konteks: {
          wargaTerpilih: { ...row },
          anggotaKeluarga: stateWithWarga.anggota,
        },
      })
      dispatch({ type: 'REPLACE_STATE', state: hasilAutofill.state })
    },
    [state, bindings, rulesAutofill],
  )

  // Mode edit: isi form dari record yang dipilih.
  useEffect(() => {
    if (record) dispatch({ type: 'LOAD_RECORD', record })
  }, [record])

  const addFotos = useCallback(
    async (files: File[]): Promise<{ added: number; skipped: number }> => {
      setFotoUploading(true)
      try {
        const { added, skipped } = await prepareFotos(state.fotos, files)
        if (added.length > 0) {
          dispatch({ type: 'ADD_FOTOS', fotos: added })
          dispatch({
            type: 'SET_INVALID',
            invalid: { ...state.invalid, fotos: false },
          })
        }
        return { added: added.length, skipped }
      } finally {
        setFotoUploading(false)
      }
    },
    [state.fotos, state.invalid],
  )

  const setFotoCaption = useCallback((index: number, caption: string) => {
    dispatch({ type: 'SET_FOTO_CAPTION', index, caption })
  }, [])

  const removeFoto = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_FOTO', index })
  }, [])

  const fillPercent = useMemo(
    () => selectFillPercent(state, templates),
    [state, templates],
  )
  const bahaCount = useMemo(() => selectBahaCount(state), [state.penilaian])
  const stepState = useMemo(
    () => selectStepState(state),
    [state.anggota, state.penilaian, state.ttd],
  )

  const handleSubmit =
    useCallback(async (): Promise<KunjunganRumahRecord | null> => {
      const { ok, invalid } = validateKunjunganRumah({ ...state, templates })
      dispatch({ type: 'SET_INVALID', invalid })
      if (!ok) {
        toast('Periksa kembali isian yang wajib diisi.')
        return null
      }
      setSaving(true)
      try {
        // Foto ke Supabase Storage bila bucket tersedia; gagal upload → simpan inline (DB jsonb).
        // Log aman: hanya status/detail infra + ukuran/tipe. Tanpa token, secret, data warga, isi foto.
        const uploadErrors: Array<{ status: number; detail: string }> = []
        const fotos = await Promise.all(
          state.fotos.map(async (f) => {
            if (f.fileUrl || !f.dataUrl) return { ...f }
            try {
              const fileUrl = await uploadDataUrl(f.dataUrl, 'kunjungan-rumah')
              const { dataUrl: _drop, ...rest } = f
              return { ...rest, fileUrl }
            } catch (e) {
              if (e instanceof StorageUploadError) {
                uploadErrors.push({ status: e.status, detail: e.detail })
                console.error(
                  '[upload-foto]',
                  JSON.stringify({
                    bucket: e.bucket,
                    status: e.status,
                    detail: e.detail,
                    bytes: e.bytes,
                    contentType: e.contentType,
                  }),
                )
              } else {
                const detail = (
                  e instanceof Error ? e.message : String(e)
                ).slice(0, 300)
                uploadErrors.push({ status: -1, detail })
                console.error(
                  '[upload-foto]',
                  JSON.stringify({ status: -1, detail }),
                )
              }
              return { ...f }
            }
          }),
        )
        if (uploadErrors.length > 0) {
          const first = uploadErrors[0]!
          toast(
            `Upload ${uploadErrors.length} foto gagal (${first.status}): ${first.detail}. Data tetap tersimpan lokal — salin pesan ini untuk diagnosis.`,
          )
        }
        const rec: KunjunganRumahRecord = {
          id: editingId ?? createRecordId(),
          schemaVersion: KUNJUNGAN_RUMAH_SCHEMA_VERSION,
          clientId: createRecordId(),
          syncedAt: new Date().toISOString(),
          waktuSimpan: new Date().toISOString(),
          info: { ...state.info },
          sanitasi: { ...state.sanitasi },
          anggota: state.anggota.map((m) => ({ ...m })),
          penilaian: state.penilaian.map((p) => ({
            ...p,
            values: { ...p.values },
            checks: { ...p.checks },
            prioritas: [...p.prioritas],
          })),
          masalah: state.masalah.map((m) => ({ ...m })),
          hasil: state.hasil,
          jadwal: state.jadwal,
          ttd: state.ttd,
          fotos: fotos.map((f) => ({ ...f })),
          tambahan: { ...state.tambahan },
        }
        const saved = editingId
          ? await updateRecord(rec)
          : await saveRecord(rec)
        toast(
          `Kunjungan rumah ${rec.info.namaKK || 'keluarga'} tersimpan di database.`,
        )
        return saved
      } catch (e) {
        // [perbaikan] pesan server ikut ditampilkan — expect: validasi `data_warga`
        //   (kolom NOT NULL) dan pesan petugas yang gagal ditulis server tidak
        //   hilang, jadi user tahu bagian mana yang harus diperbaiki.
        const detail = e instanceof Error ? e.message : String(e)
        toast(`Gagal menyimpan ke database. ${detail}`.slice(0, 400))
        return null
      } finally {
        setSaving(false)
      }
    }, [state, templates, editingId, toast, saveRecord, updateRecord])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const removeRecord = useCallback(
    async (id: string) => {
      await removeDbRecord(id)
    },
    [removeDbRecord],
  )

  return {
    templates,
    handleWargaSelected,
    state,
    dispatch,
    records,
    recordsLoading,
    recordsError,
    fillPercent,
    bahaCount,
    stepState,
    handleSubmit,
    reset,
    removeRecord,
    addFotos,
    setFotoCaption,
    removeFoto,
    fotoUploading,
    saving,
  }
}
