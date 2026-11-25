export const KELS = ['Trajeng', 'Ngemplakrejo', 'Tambaan', 'Mayangan'] as const
export const PRIOS = [
  'ODGJ',
  'Bumil Risti',
  'Balita Risti',
  'TB',
  'Stunting',
] as const
export const POSY = ['Melati 1', 'Mawar 2', 'Kenanga', 'Flamboyan'] as const
export const JENIS_KEGIATAN = [
  'Penyuluhan',
  'Posyandu',
  'Kelas ibu',
  'Senam',
  'Gotong royong',
  'Pelatihan kader',
] as const
export const HASIL_KUNJUNGAN_RUMAH = [
  'Selesai — sehat / terkendali',
  'Kontrol ulang',
  'Rujuk ke Puskesmas',
] as const

/**
 * `forms.kode` untuk dua form bawaan.
 *
 * Dipisah dari `forms.nama` karena `nama` boleh diubah admin, sedangkan seeder dan
 * pembacaan form harus menemukan form yang sama apa pun nama yang dipilih admin.
 * Jangan diubah: idempotensi seeding bergantung padanya.
 */
export const KODE_FORM_BAWAAN = {
  kegiatan: 'KEGIATAN_PEMBERDAYAAN',
  kunjunganRumah: 'CHECKLIST_KUNJUNGAN_RUMAH',
} as const

export const APP_BRAND = {
  name: 'PUSKESMAS TRAJENG',
  region: 'KOTA PASURUAN',
} as const

// Kunci localStorage yang masih dipakai. Kunci `pws-admin-*` (items/prios/staff) dan
// `pws-kunjungan-rumah-templates` dihapus dari daftar ini karena datanya pindah ke
// database; sisa datanya di localStorage browser tidak dihapus otomatis tapi sudah
// tidak dibaca aplikasi lagi.
export const STORAGE_KEYS = {
  rekap: 'pws-rekap',
  // Versi tur onboarding yang sudah dilihat di perangkat ini. Disimpan sebagai
  // angka, bukan boolean, supaya versi tur baru bisa muncul sekali lagi.
  tour: 'pws-tour',
} as const

export const SESSION_IDLE_MS = 60 * 60 * 1000 // idle 1 jam → geser terus tiap akses (sliding)
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // plafon absolut 12 jam (exp JWT + umur cookie)

export const SESSION_PROFILE = {
  username: 'admin',
  name: 'A. Jubaidi',
  role: 'Admin',
} as const

export const PAGE_SIZE = 10

export const MAX_FOTO = 6
export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const BLOCKED_MIME = new Set(['image/svg+xml', 'image/svg'])

/**
 * Prefix object foto untuk jawaban field `image` di form generik.
 *
 * Path disimpan di `survey_entries.value`, bukan URL: signed URL kedaluwarsa.
 * Prefix ini ikut jalur upload dan signed URL yang sudah dipakai kunjungan rumah.
 */
export const PREFIX_FOTO_FORM = 'form'
/** Path sah di bucket privat `foto`, untuk semua prefix yang diizinkan server. */
export const PATH_FOTO =
  /^(?:kunjungan-rumah|form)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/
/** Path yang boleh ditulis field `image`; mencegah path form disalahpakai ke prefix lain. */
export const PATH_FOTO_FORM = /^form\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/
