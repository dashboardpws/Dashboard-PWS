import { useAsyncData } from '@/hooks/use-async-data'
import { getKunjunganRumahTemplate } from '@/lib/api/server-fns'
import { templateFromRows } from '@/lib/kunjungan-rumah/template/template-from-rows'
import type { KunjunganRumahTemplateRows } from '@/lib/kunjungan-rumah/template/template-from-rows'
import {
  createDefaultKunjunganRumahTemplates,
  validateKunjunganRumahTemplates,
} from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type {
  RuleAutofill,
  RuleVisibilitas,
} from '@/lib/form-builder/engine/types'

/** Definisi bawaan, dipakai kalau DB kosong atau gagal dibaca. */
const FALLBACK = createDefaultKunjunganRumahTemplates()

interface HasilTemplateDb {
  templates: KunjunganRumahTemplates
  rulesAutofill: RuleAutofill[]
  rulesVisibilitas: RuleVisibilitas[]
  source: 'db' | 'fallback'
  pesan: string | null
}

/** Template form dari DB; jatuh ke `FALLBACK` supaya form tidak blank saat DB bermasalah. */
export function useKunjunganRumahTemplateDb() {
  const { data, loading, error, reload } = useAsyncData<HasilTemplateDb>(
    async () => {
      const rows:
        | (KunjunganRumahTemplateRows & {
            aturan: {
              autofill: RuleAutofill[]
              visibilitas: RuleVisibilitas[]
            }
          })
        | null = await getKunjunganRumahTemplate()
      if (!rows) {
        return {
          templates: FALLBACK,
          rulesAutofill: [],
          rulesVisibilitas: [],
          source: 'fallback',
          pesan:
            'Form kunjungan rumah belum ada di database, memakai definisi bawaan.',
        }
      }
      // Hasil mapper divalidasi ulang dengan validator yang sama seperti localStorage,
      // supaya baris DB yang rusak tidak sampai jadi form yang tidak bisa diisi.
      const mapped = templateFromRows(rows)
      if (validateKunjunganRumahTemplates(mapped)) {
        return {
          templates: mapped,
          rulesAutofill: rows.aturan.autofill,
          rulesVisibilitas: rows.aturan.visibilitas,
          source: 'db',
          pesan: null,
        }
      }
      return {
        templates: FALLBACK,
        rulesAutofill: [],
        rulesVisibilitas: [],
        source: 'fallback',
        pesan:
          'Definisi form dari database tidak valid, memakai definisi bawaan.',
      }
    },
    [],
    {
      templates: FALLBACK,
      rulesAutofill: [],
      rulesVisibilitas: [],
      source: 'fallback',
      pesan: null,
    },
    {
      cancel: false,
      // Pesan asli ikut ditampilkan: mapper dan server fn sudah menulis alasan yang
      // bisa ditindaklanjuti (mis. versi definisi tidak cocok).
      mapError: (e) =>
        e instanceof Error
          ? e.message
          : 'Gagal memuat definisi form dari database.',
    },
  )

  return {
    templates: data.templates,
    rulesAutofill: data.rulesAutofill,
    rulesVisibilitas: data.rulesVisibilitas,
    loading,
    error: loading ? null : (error ?? data.pesan),
    source: data.source,
    refresh: reload,
  }
}
