import type { SurveyRow } from '@/lib/api/server-fns'

/** Bentuk baris dari `getFormAdaSubmit()`: satu baris per form yang punya submit. */
export type BarisFormFilter = {
  formId: number
  nama: string
  jumlahSubmit: number
}

/**
 * formId untuk satu baris isian, dicocokkan lewat `formNama`.
 *
 * Berada di modul sendiri (bukan di dalam komponen `Laporan`) dengan sengaja:
 * sebelumnya ini `const` di dalam komponen yang dipanggil dari `useMemo` di
 * atas deklarasinya, jadi memilih filter form selain "Semua form" melempar
 * `ReferenceError` — binding belum diinisialisasi saat callback `useMemo`
 * berjalan. Untuk apa pun bentuknya, hal itu tidak akan terulang selama
 * helper ini murni dan dideklarasikan sebelum pemakaian.
 *
 * Pencarian linear per baris memang mahal, tapi `forms` berisi daftar FORM,
 * bukan daftar isian — ukurannya kecil dan tidak bertambah saat baris bertambah.
 * Kalau nanti jadi bottleneck, ganti dengan Map yang dibangun sekali per render.
 */
export function formIdOf(
  r: Pick<SurveyRow, 'formNama'>,
  forms: BarisFormFilter[],
): number {
  return forms.find((f) => f.nama === r.formNama)?.formId ?? -1
}

/** Predicate yang juga dipakai route laporan, bukan replika di test. */
export function cocokDenganForm(
  r: Pick<SurveyRow, 'formNama'>,
  formId: number | 'all',
  forms: BarisFormFilter[],
): boolean {
  return formId === 'all' || formIdOf(r, forms) === formId
}

export function filterByForm<T extends Pick<SurveyRow, 'formNama'>>(
  rows: readonly T[],
  formId: number | 'all',
  forms: BarisFormFilter[],
): T[] {
  return rows.filter((r) => cocokDenganForm(r, formId, forms))
}
