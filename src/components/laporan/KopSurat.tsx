import type { ReactNode } from 'react'
import { KopBrandRow } from './KopBrandRow'
import { TandaTangan } from './TandaTangan'

export interface KopSuratProps {
  judul: string
  subtitle: ReactNode
  ttdNama: string
  ttdJabatan: string
  children: ReactNode
}

export function KopSurat({
  judul,
  subtitle,
  ttdNama,
  ttdJabatan,
  children,
}: KopSuratProps) {
  return (
    <div className="kop-surat mt-3.5 rounded-[10px] border border-dashed border-line bg-surface p-4 text-xs">
      <KopBrandRow />
      <div className="mt-5 text-center">
        <b className="text-sm text-ink">{judul}</b>
        <div className="mt-1 text-muted">{subtitle}</div>
      </div>
      {children}
      <TandaTangan nama={ttdNama} jabatan={ttdJabatan} />
    </div>
  )
}
