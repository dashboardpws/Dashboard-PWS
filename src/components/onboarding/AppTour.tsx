import { Tour } from '@mantine/core'
import type { TourLabels } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { posisiLangkah, targetLangkah } from '@/lib/onboarding/tour'
import type { LangkahTour, PerangkatTour } from '@/lib/onboarding/tour'

const LABEL_TOUR: Partial<TourLabels> = {
  next: 'Lanjut',
  back: 'Kembali',
  skip: 'Lewati',
  close: 'Tutup',
  stepCounter: (current, total) => `${current} dari ${total}`,
}

export interface AppTourProps {
  aktif: boolean
  daftarLangkah: readonly LangkahTour[]
  langkah: number
  onLangkahChange: (langkah: number) => void
  onTutup: () => void
}

/**
 * Kulit Mantine Tour untuk onboarding.
 *
 * Daftar langkah per halaman, target, dan penanda localStorage ada di
 * `lib/onboarding/tour.ts` supaya bisa diuji tanpa DOM. Komponen ini hanya
 * memilih target yang cocok dengan perangkat lalu merender langkah halaman
 * yang sedang aktif.
 */
export function AppTour({
  aktif,
  daftarLangkah,
  langkah,
  onLangkahChange,
  onTutup,
}: AppTourProps) {
  // Breakpoint disamakan dengan `md` Tailwind: sidebar tampil >= 768px,
  // bottom nav hanya di bawahnya.
  const mobile = useMediaQuery('(max-width: 47.999rem)', false)
  const perangkat: PerangkatTour = mobile ? 'mobile' : 'desktop'

  return (
    <Tour
      active={aktif}
      step={langkah}
      onStepChange={onLangkahChange}
      onClose={onTutup}
      labels={LABEL_TOUR}
      color="teal"
      maxWidth={340}
      spotlightPadding={6}
      closeOnOverlayClick={false}
    >
      {daftarLangkah.map((item, index) => (
        <Tour.Step
          key={`${item.title}-${index}`}
          target={targetLangkah(item.target, perangkat)}
          position={posisiLangkah(item.position, perangkat)}
          title={item.title}
        >
          {item.body}
        </Tour.Step>
      ))}
    </Tour>
  )
}
