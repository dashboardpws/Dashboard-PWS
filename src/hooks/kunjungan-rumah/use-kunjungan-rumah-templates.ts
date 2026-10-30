import { useKunjunganRumahTemplateDb } from './use-kunjungan-rumah-template-db'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'

/**
 * Definisi form kunjungan rumah dibaca dari database, bukan localStorage.
 *
 * Definisinya hanya-baca di sini: seluruh perubahan lewat Form Builder, yang
 * menyunting tabel `forms`/`form_sections`/`form_fields`/`form_field_options`
 * lewat siklus draft-publish. Jadi hook ini tidak lagi mengekspos jalur tulis
 * (`setTemplates`, `resetTemplates`, `importJson`) maupun ekspor JSON — semua
 * ikut hilang bersama tab "Form Kunjungan Rumah". Export memang masih berguna
 * sebagai backup, tapi belum ada tempat yang wajar untuk meletakkannya sekarang
 * bahwa form ini bisa disunting admin.
 *
 * Hook dipakai di tiga tempat: form kader (`useKunjunganRumahForm`) untuk
 * merender pertanyaan, rekap (`use-rekap-kunjungan-rumah`) untuk menghitung
 * field, dan `/kelola` untuk angka field aktif.
 */
export function useKunjunganRumahTemplates() {
  const {
    templates,
    rulesAutofill,
    rulesVisibilitas,
    loading,
    error,
    source,
    refresh,
  } = useKunjunganRumahTemplateDb()

  return {
    templates,
    rulesAutofill,
    rulesVisibilitas,
    loading,
    error,
    source,
    refresh,
  }
}

export type { KunjunganRumahTemplates }
