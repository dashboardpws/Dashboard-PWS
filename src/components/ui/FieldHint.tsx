import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ikon petunjuk di samping label field.
 *
 * `FormField` membungkus input di dalam `<label>`, jadi pemicinya sengaja
 * `<span role="button">`, bukan `<button>`: tombol termasuk labelable element
 * dan tidak sah jadi descendant `<label>` selain kontrol yang dilabeli.
 * Klik pada span juga harus `preventDefault`, kalau tidak label akan meneruskan
 * klik itu ke input dan fokus berpindah sebelum petugas sempat membaca.
 *
 * Petunjuk muncul saat fokus dan hilang saat fokus berpindah. Tidak memakai
 * `title` karena tooltip native tidak bisa diandalkan di layar HP, dan tidak
 * butuh state "klik di luar" karena berpindah sentuhan sudah menutupnya.
 */
export interface FieldHintProps {
  text: ReactNode
  className?: string
}

export function FieldHint({ text, className }: FieldHintProps) {
  const [terbuka, setTerbuka] = useState(false)
  const id = useId()

  return (
    <span
      className={cn('relative inline-flex shrink-0 align-middle', className)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label="Lihat petunjuk pengisian"
        aria-expanded={terbuka}
        aria-describedby={terbuka ? id : undefined}
        onFocus={() => setTerbuka(true)}
        onBlur={() => setTerbuka(false)}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.focus()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur()
        }}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-muted-soft outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent-border"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      {terbuka ? (
        <span
          id={id}
          role="tooltip"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          className="absolute left-0 top-full z-30 mt-1.5 w-max max-w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-line bg-surface px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-ink-2 shadow-elev"
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}
