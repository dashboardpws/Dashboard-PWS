/**
 * Upload foto dari browser lewat server function.
 *
 * Kunci Supabase tidak pernah sampai ke client. Server memvalidasi ulang tipe
 * dan ukuran sebelum menulis ke bucket privat.
 */
import { uploadFoto } from '@/lib/api/server-fns'

export async function uploadFotoDataUrl(
  dataUrl: string,
  prefix = 'kunjungan-rumah',
): Promise<string> {
  const { path } = await uploadFoto({ data: { dataUrl, prefix } })
  return path
}
