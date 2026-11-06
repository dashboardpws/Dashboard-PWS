/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Link } from '@tanstack/react-router'
import { Pencil, Trash2 } from 'lucide-react'
import { HistoryPanel } from '@/components/shared/HistoryPanel'
import { HistoryRow } from '@/components/ui/HistoryRow'
import { Tag } from '@/components/ui/Tag'
import { fmtDate } from '@/lib/utils'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type { KunjunganRumahRecord } from '@/lib/kunjungan-rumah/types'

interface Props {
  records: KunjunganRumahRecord[]
  templates: KunjunganRumahTemplates
  onDelete?: (id: string) => void
}

export function HistorySection({ records, templates, onDelete }: Props) {
  return (
    <HistoryPanel
      items={records.map((r) => (
        <HistoryRow key={r.id} layout="stack">
          <div className="flex flex-wrap items-center gap-2">
            <b>{r.info.namaKK || 'Tanpa nama KK'}</b>
            {r.penilaian.map((p) => (
              <Tag key={p.id} className="hidden! md:inline!">
                {templates.sasaran[p.sasaran]
                  ? templates.sasaran[p.sasaran].label
                  : p.sasaran}
              </Tag>
            ))}
            {r.penilaian
              .flatMap((p) => p.prioritas)
              .map((prio, j) => (
                <Tag key={`${prio}-${j}`} priority={prio} />
              ))}
            <span className="text-muted">{fmtDate(r.info.tglPengumpulan)}</span>
          </div>
          <span className="text-muted hidden md:inline">
            Posyandu {r.info.posyandu} · Kel. {r.info.kelurahan} ·{' '}
            {r.anggota.length} anggota · hasil: {r.hasil}
          </span>
          <span className="text-muted">
            {r.penilaian.length} penilaian sasaran · {r.masalah.length} masalah
            · {r.fotos?.length ?? 0} foto · kader {r.ttd}
          </span>
          <div className="flex gap-2">
            <Link
              to="/kunjungan-rumah/$id"
              params={{ id: r.id }}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-accent hover:text-accent"
            >
              <Pencil size={12} /> Edit
            </Link>
            <button
              type="button"
              onClick={() => onDelete?.(r.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-semibold text-danger hover:border-danger"
            >
              <Trash2 size={12} /> Hapus
            </button>
          </div>
        </HistoryRow>
      ))}
    />
  )
}
