import { STORAGE_KEYS } from '@/lib/constants'

/**
 * Versi isi tur. Naikkan angka ini kalau langkah tur berubah cukup banyak,
 * supaya kader yang sudah pernah ikut tur melihat versi barunya sekali lagi.
 * Penanda disimpan per halaman, jadi versi baru berarti tur tiap halaman
 * muncul sekali lagi.
 */
export const VERSI_TOUR = 1

export type PerangkatTour = 'desktop' | 'mobile'

export type PosisiTour =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'

/** Rute yang punya tur. Dibatasi supaya salah ketik path ketahuan saat typecheck. */
export type RuteTour =
  '/' | '/sasaran' | '/kunjungan-rumah' | '/form' | '/laporan' | '/notifikasi'

export interface TargetPerangkat {
  desktop: string
  mobile: string
}

export interface PosisiPerangkat {
  desktop: PosisiTour
  mobile: PosisiTour
}

export interface LangkahTour {
  /**
   * Selector CSS elemen yang disorot. Langkah tanpa target tampil di tengah
   * layar. Target sebaiknya elemen statis halaman (header, filter, kartu
   * ringkasan), bukan elemen hasil muat data, supaya tur tidak menunggu lama.
   */
  target?: string | TargetPerangkat
  position?: PosisiTour | PosisiPerangkat
  title: string
  body: string
}

/**
 * Tur dipisah per halaman supaya user tidak dipindah halaman otomatis.
 * Setiap halaman hanya menyorot elemen yang memang ada di halaman itu.
 *
 * Dashboard memakai langkah pembuka karena halaman itu yang pertama dibuka
 * setelah login. Halaman lain cukup satu langkah: langsung ke fitur utamanya.
 */
export const TOUR_HALAMAN: Partial<Record<RuteTour, readonly LangkahTour[]>> = {
  '/': [
    {
      title: 'Selamat datang di Dashboard PWS',
      body: 'Aplikasi ini membantu kader mencatat kunjungan rumah dan kegiatan Posyandu. Tur ini hanya di halaman dashboard; halaman lain punya tur sendiri.',
    },
    {
      target: '[data-tour="dashboard-statistik"]',
      position: 'bottom',
      title: 'Ringkasan dashboard',
      body: 'Tiga kartu ini menunjukkan jumlah warga terdata, warga yang sudah dikunjungi, dan total isian form. Data per kelurahan ada di bagian bawahnya.',
    },
    {
      target: {
        desktop: '[data-tour="nav-sidebar"]',
        mobile: '[data-tour="nav-bottom"]',
      },
      position: { desktop: 'right', mobile: 'top' },
      title: 'Menu utama',
      body: 'Semua fitur ada di menu ini. Di HP, menu Data Sasaran, Formulir, dan Kelola ada di tombol menu (tiga garis) di kiri atas.',
    },
  ],
  '/sasaran': [
    {
      target: '[data-tour="sasaran-filter"]',
      position: 'bottom',
      title: 'Data Sasaran',
      body: 'Cari warga lewat nama atau NIK, lalu saring berdasarkan status dan kelurahan. Klik nama warga untuk membuka detail dan riwayat kunjungannya.',
    },
  ],
  '/kunjungan-rumah': [
    {
      target: '[data-tour="kunjungan-rumah-header"]',
      position: 'bottom',
      title: 'Kunjungan Rumah',
      body: 'Ini alur utama: pilih sasaran, isi checklist kunjungan, lalu simpan. Data langsung masuk ke database dan tampil di dashboard.',
    },
  ],
  '/form': [
    {
      target: '[data-tour="form-list"]',
      position: 'bottom',
      title: 'Formulir',
      body: 'Daftar form yang siap diisi. Form kunjungan rumah dan form kegiatan Posyandu muncul di sini setelah diterbitkan di Kelola.',
    },
  ],
  '/laporan': [
    {
      target: '[data-tour="laporan-filter"]',
      position: 'bottom',
      title: 'Laporan & Export',
      body: 'Filter data berdasarkan tanggal dan kelurahan, lihat rekap, lalu cetak atau unduh CSV untuk laporan.',
    },
  ],
  '/notifikasi': [
    {
      target: '[data-tour="notifikasi-ringkasan"]',
      position: 'bottom',
      title: 'Notifikasi',
      body: 'Pengingat otomatis untuk jadwal kunjungan, sasaran yang perlu diperbarui, dan tindak lanjut. Angka kritis membantu menentukan prioritas.',
    },
  ],
}

/**
 * Mengambil langkah untuk pathname apa adanya. Route yang tidak terdaftar
 * mengembalikan daftar kosong, bukan undefined, supaya pemanggil tidak perlu
 * menangani dua bentuk hasil.
 */
export function langkahUntukHalaman(halaman: string): readonly LangkahTour[] {
  if (!(halaman in TOUR_HALAMAN)) return []
  return TOUR_HALAMAN[halaman as RuteTour] ?? []
}

/** Bentuk minimal localStorage yang dipakai helper ini; memudahkan unit test tanpa DOM. */
export interface PenyimpananTour {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function penyimpananBrowser(): PenyimpananTour | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    // Safari mode privat bisa melempar saat localStorage diakses. Tur tetap boleh
    // jalan; penandanya hanya tidak tersimpan.
    return null
  }
}

/**
 * Penanda disimpan per halaman, misalnya `pws-tour:/sasaran`. Dengan begitu
 * tur dashboard tidak dianggap mewakili tur laporan, dan sebaliknya.
 */
export function kunciTour(halaman: string): string {
  return `${STORAGE_KEYS.tour}:${halaman}`
}

export function bacaVersiTour(
  halaman: string,
  storage: PenyimpananTour | null = penyimpananBrowser(),
): number {
  if (!storage) return 0

  try {
    const mentah = storage.getItem(kunciTour(halaman))
    if (!mentah) return 0

    const versi = Number(mentah)
    return Number.isInteger(versi) && versi > 0 ? versi : 0
  } catch {
    return 0
  }
}

export function sudahMengikutiTour(
  halaman: string,
  storage: PenyimpananTour | null = penyimpananBrowser(),
): boolean {
  return bacaVersiTour(halaman, storage) >= VERSI_TOUR
}

export function tandaiTourSelesai(
  halaman: string,
  storage: PenyimpananTour | null = penyimpananBrowser(),
): void {
  if (!storage) return

  try {
    storage.setItem(kunciTour(halaman), String(VERSI_TOUR))
  } catch {
    // Kuota penuh atau storage diblokir bukan alasan menggagalkan penutupan tur.
    // Konsekuensinya tur bisa muncul lagi setelah refresh.
  }
}

export function targetLangkah(
  target: LangkahTour['target'],
  perangkat: PerangkatTour,
): string | undefined {
  if (!target) return undefined
  if (typeof target === 'string') return target
  return perangkat === 'mobile' ? target.mobile : target.desktop
}

export function posisiLangkah(
  position: LangkahTour['position'],
  perangkat: PerangkatTour,
): PosisiTour | undefined {
  if (!position) return undefined
  if (typeof position === 'string') return position
  return perangkat === 'mobile' ? position.mobile : position.desktop
}
