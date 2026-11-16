import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Button,
  EmptyState,
  HistoryRow,
  Pill,
  SectionCard,
  Select,
} from '@/components/ui'
import { WARNING_CONFIG } from '@/lib/dashboard/warning.config'
import type { Warning } from '@/lib/dashboard/warning'
import { selectTopWarnings, warningTarget } from '@/lib/dashboard/warning'
import { SEVERITY_META } from '@/components/dashboard/severity'

interface Props {
  warnings: Warning[]
  /** Jika diisi bersama onRegionChange, filter wilayah ditampilkan. */
  regions?: string[]
  region?: string // "all" | nama wilayah
  onRegionChange?: (region: string) => void
  limit?: number
}

export function PerluPerhatian({
  warnings,
  regions,
  region = 'all',
  onRegionChange,
  limit = WARNING_CONFIG.display.maxItems,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const { visible, all, hidden } = selectTopWarnings(warnings, limit)
  const rows = expanded ? all : visible

  const total = all.length
  const regionFilter =
    regions && onRegionChange ? (
      <Select
        value={region}
        onChange={(e) => onRegionChange(e.target.value)}
        aria-label="Filter wilayah peringatan"
        className="max-w-40"
      >
        <option value="all">Semua wilayah</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
    ) : null

  return (
    <SectionCard
      title="Perlu Perhatian"
      sub={
        total > 0
          ? `${total} peringatan aktif. Pilih peringatan untuk melompat ke data terkait.`
          : 'Peringatan muncul otomatis dari cakupan kunjungan, jadwal, dan tindak lanjut.'
      }
      actions={regionFilter}
    >
      {rows.length === 0 ? (
        <EmptyState>Tidak ada peringatan aktif.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((w) => {
            const t = warningTarget(w)
            return (
              <li key={w.id}>
                <HistoryRow className="items-start">
                  <Pill
                    variant={SEVERITY_META[w.severity].variant}
                    size="sm"
                    bold
                    className="mt-0.5 shrink-0"
                  >
                    {SEVERITY_META[w.severity].label}
                  </Pill>
                  <div className="min-w-0 flex-1">
                    {/* `search as never`: tipe search TanStack Router per-route; sempit di sini
                        karena target ditentukan dinamis oleh warningTarget */}
                    <Link
                      to={t.to}
                      search={t.search as never}
                      hash={t.hash}
                      className="font-semibold text-ink hover:underline"
                    >
                      {w.title}
                    </Link>
                    {w.description ? (
                      <div className="text-[11px] text-muted">
                        {w.description}
                      </div>
                    ) : null}
                  </div>
                  {w.region ? (
                    <Pill
                      variant="pending"
                      shape="pill"
                      size="xs"
                      className="mt-0.5 shrink-0"
                    >
                      {w.region}
                    </Pill>
                  ) : null}
                </HistoryRow>
              </li>
            )
          })}
        </ul>
      )}

      {hidden > 0 || expanded ? (
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? 'Tampilkan lebih sedikit' : `Lihat semua (${total}) →`}
          </Button>
        </div>
      ) : null}
    </SectionCard>
  )
}
