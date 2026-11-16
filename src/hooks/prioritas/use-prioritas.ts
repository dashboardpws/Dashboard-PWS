import { useCallback } from 'react'
import { useAsyncData } from '@/hooks/use-async-data'
import {
  listPrioritasProgram,
  simpanPrioritasProgram,
  setPrioritasProgramAktif,
} from '@/lib/api/server-fns'
import type { BarisPrioritas } from '@/lib/prioritas/prioritas'

export function usePrioritas() {
  const { data, loading, error, reload } = useAsyncData(
    async () => (await listPrioritasProgram()) as BarisPrioritas[],
    [],
    [] as BarisPrioritas[],
    { mapError: () => 'Gagal memuat prioritas.' },
  )
  const save = useCallback(
    async (kode: string | null, nama: string) => {
      await simpanPrioritasProgram({ data: { kode: kode ?? undefined, nama } })
      await reload()
    },
    [reload],
  )
  const setAktif = useCallback(
    async (kode: string, aktif: boolean) => {
      await setPrioritasProgramAktif({ data: { kode, aktif } })
      await reload()
    },
    [reload],
  )
  return { prioritas: data, loading, error, refresh: reload, save, setAktif }
}
