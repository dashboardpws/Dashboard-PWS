/** Pesan untuk field yang sudah punya isian dan karena itu tidak boleh dihapus. */
export function pesanFieldTerpakai(
  dipakai: { fieldId: string; total: number }[],
  namaField: Map<string, string>,
): string {
  const total = dipakai.reduce((n, d) => n + d.total, 0)
  const contoh = dipakai
    .slice(0, 3)
    .map((d) => `"${namaField.get(d.fieldId) ?? d.fieldId}" (${d.total} isian)`)
    .join(', ')
  const sisa =
    dipakai.length > 3 ? `, dan ${dipakai.length - 3} field lainnya` : ''
  return (
    `Field ${contoh}${sisa} sudah punya ${total} isian, jadi tidak bisa dihapus. ` +
    'Nonaktifkan fieldnya lewat ikon mata, atau hapus isiannya dulu.'
  )
}
