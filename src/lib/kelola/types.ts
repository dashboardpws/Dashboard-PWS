// Tab "Form Kunjungan Rumah" juga dihapus. Definisi form kunjungan rumah sekarang
// disunting lewat Form Builder seperti form lain, dan bagian yang tidak boleh
// diubah dikunci di editor (lihat `aturanForm`). Catatan lama yang menyuruh
// form bawaan disunting lewat tab sendiri tidak berlaku lagi sejak form bawaan
// ikut tampil di Form Builder.
export const TABS = [
  { key: 'form-builder', label: 'Form Builder' },
  { key: 'priority', label: 'Prioritas' },
  { key: 'facility', label: 'Fasilitas' },
  { key: 'staff', label: 'Kader' },
] as const

export type KelolaTab = (typeof TABS)[number]['key']
