import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth/auth'
import { getKunjunganRumah } from '@/lib/api/server-fns'
import { sanitizeRecord } from '@/lib/kunjungan-rumah/types'
import { KunjunganRumahFormScene } from '@/components/kunjungan-rumah/KunjunganRumahFormScene'
import type { KunjunganRumahRecord } from '@/lib/kunjungan-rumah/types'

export const Route = createFileRoute('/kunjungan-rumah_/$id')({
  beforeLoad: requireAuth,
  loader: async ({
    params,
  }): Promise<{ record: KunjunganRumahRecord | null }> => {
    const row = await getKunjunganRumah({ data: { id: params.id } })
    if (!row) return { record: null }
    return { record: sanitizeRecord(row) }
  },
  component: KunjunganRumahEdit,
})

function KunjunganRumahEdit() {
  const { record } = Route.useLoaderData()
  // Record tidak ditemukan: fallback ke halaman input baru.
  return <KunjunganRumahFormScene record={record} />
}
