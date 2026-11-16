import { useCallback } from 'react'
import { useAsyncData } from '@/hooks/use-async-data'
import {
  hapusFasilitas,
  listFasilitasKelola,
  listFasKesOpsi,
  listWilayahKerjaOpsi,
  simpanFasilitas,
} from '@/lib/api/server-fns'
import type {
  BarisFasilitas,
  DraftFasilitas,
  OpsiWilayah,
} from '@/lib/faskes/fasilitas'
import type { OpsiFasilitas } from '@/lib/petugas/user-registry'

export function useFasilitas() {
  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [rows, wilayah, opsi] = await Promise.all([
        listFasilitasKelola(),
        listWilayahKerjaOpsi(),
        listFasKesOpsi(),
      ])
      return {
        rows,
        wilayah,
        opsi,
      }
    },
    [],
    {
      rows: [] as BarisFasilitas[],
      wilayah: [] as OpsiWilayah[],
      opsi: [] as OpsiFasilitas[],
    },
    { mapError: () => 'Gagal memuat fasilitas kesehatan.' },
  )
  const save = useCallback(
    async (draft: DraftFasilitas, id?: number) => {
      await simpanFasilitas({ data: { ...draft, id } })
      await reload()
    },
    [reload],
  )
  const remove = useCallback(
    async (id: number) => {
      await hapusFasilitas({ data: { id } })
      await reload()
    },
    [reload],
  )
  return { ...data, loading, error, refresh: reload, save, remove }
}
