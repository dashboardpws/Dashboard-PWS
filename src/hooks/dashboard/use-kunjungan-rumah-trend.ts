import { useCallback, useEffect, useRef, useState } from 'react'
import { getKunjunganRumahMonthlyStats } from '@/lib/api/server-fns'
import type { MonthlyKunjunganRumahStat } from '@/lib/kunjungan-rumah/dashboard'

export function useKunjunganRumahTrend() {
  const [data, setData] = useState<MonthlyKunjunganRumahStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const epochRef = useRef(0)

  const reload = useCallback(async () => {
    const epoch = ++epochRef.current
    setLoading(true)
    setError(null)
    try {
      const hasil = await getKunjunganRumahMonthlyStats()
      if (epoch !== epochRef.current) return
      setData(hasil)
    } catch (err) {
      if (epoch !== epochRef.current) return
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat tren kunjungan rumah',
      )
    } finally {
      if (epoch === epochRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
