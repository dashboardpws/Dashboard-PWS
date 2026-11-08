import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'
import { AppTour } from '@/components/onboarding/AppTour'
import {
  langkahUntukHalaman,
  sudahMengikutiTour,
  tandaiTourSelesai,
} from '@/lib/onboarding/tour'
import { useAuth } from '@/providers/auth'

interface TourContextValue {
  /** Membuka tur halaman yang sedang aktif. Tidak melakukan apa-apa kalau halaman belum punya tur. */
  mulaiTour: () => void
  /** False kalau halaman aktif belum punya langkah; Topbar memakai ini untuk menyembunyikan tombol bantuan. */
  tersedia: boolean
}

const TourContext = createContext<TourContextValue>({
  mulaiTour: () => {},
  tersedia: false,
})

export function useTour(): TourContextValue {
  return useContext(TourContext)
}

/**
 * Jeda sebelum tur otomatis dimulai. Halaman masih merender header dan filter
 * saat pertama dibuka; memberi jeda kecil membuat elemen target sudah terpasang
 * ketika Mantine mencari posisinya.
 */
const JEDA_AUTO_MS = 900

/**
 * Menyimpan status tur di level root supaya tombol bantuan di Topbar dan
 * overlay tur berbagi state yang sama. Tur sendiri tidak berpindah halaman;
 * kalau user navigasi, tur halaman lama ditutup.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const pathname = useLocation({ select: (location) => location.pathname })
  const daftarLangkah = langkahUntukHalaman(pathname)
  const tersedia = daftarLangkah.length > 0

  const [aktif, setAktif] = useState(false)
  const [langkah, setLangkah] = useState(0)
  const aktifRef = useRef(false)
  // Halaman pemilik tur yang sedang jalan. Dipakai saat menandai selesai,
  // supaya penanda tetap masuk ke halaman yang benar walau pathname berubah.
  const halamanTour = useRef(pathname)

  useEffect(() => {
    aktifRef.current = aktif
  }, [aktif])

  const mulaiTour = useCallback(() => {
    if (!tersedia) return

    halamanTour.current = pathname
    setLangkah(0)
    setAktif(true)
  }, [pathname, tersedia])

  const tutupTour = useCallback(() => {
    setAktif(false)
    tandaiTourSelesai(halamanTour.current)
  }, [])

  // Tur hanya untuk sesi yang valid. Logout atau redirect ke /pin harus
  // menutup overlay, bukan meninggalkannya menutupi halaman login.
  useEffect(() => {
    if (!user || pathname === '/pin') {
      setAktif(false)
    }
  }, [user, pathname])

  // User pindah halaman sendiri saat tur masih terbuka. Tur halaman lama
  // ditutup dan dianggap sudah dilihat, jadi tidak muncul lagi di kunjungan
  // berikutnya.
  useEffect(() => {
    if (!aktif) return
    if (pathname === halamanTour.current) return

    setAktif(false)
    tandaiTourSelesai(halamanTour.current)
  }, [aktif, pathname])

  // Auto-start sekali per halaman per perangkat. Hanya setelah sesi valid dan
  // hanya kalau timer selesai saat user masih di halaman yang sama.
  useEffect(() => {
    if (!user || pathname === '/pin') return
    if (!tersedia) return
    if (sudahMengikutiTour(pathname)) return

    const timer = window.setTimeout(() => {
      if (aktifRef.current) return
      if (window.location.pathname !== pathname) return

      halamanTour.current = pathname
      setLangkah(0)
      setAktif(true)
    }, JEDA_AUTO_MS)

    return () => window.clearTimeout(timer)
  }, [user, pathname, tersedia])

  const value = useMemo(() => ({ mulaiTour, tersedia }), [mulaiTour, tersedia])

  return (
    <TourContext.Provider value={value}>
      {children}
      <AppTour
        aktif={aktif}
        daftarLangkah={daftarLangkah}
        langkah={langkah}
        onLangkahChange={setLangkah}
        onTutup={tutupTour}
      />
    </TourContext.Provider>
  )
}
