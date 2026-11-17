import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { DonutChart } from '@mantine/charts'
import { useOverlayClose } from '@/hooks/use-overlay-close'
import { ProgressBar } from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import type { PrioritasKelurahan } from '@/lib/dashboard/prioritas-kelurahan'

interface Props {
  data: PrioritasKelurahan
  onClose: () => void
}

/**
 * Warna segmen memakai token chip prioritas yang sudah dipakai Tag/Pill, supaya
 * satu kode prioritas punya warna yang sama di seluruh aplikasi. Kode custom
 * jatuh ke warna chart netral.
 */
const WARNA_PRIORITAS: Record<string, string> = {
  ODGJ: 'var(--color-chip-prio-odgj-text)',
  'Bumil Risti': 'var(--color-chip-prio-bumil-text)',
  'Balita Risti': 'var(--color-chip-prio-balita-text)',
  TB: 'var(--color-chip-prio-tb-text)',
  Stunting: 'var(--color-chip-prio-stunt-text)',
}

const WARNA_TANPA_PRIORITAS = 'var(--color-muted)'
const WARNA_BELUM_DIKUNJUNGI = 'var(--color-line-2)'

function colorPrioritas(kode: string): string {
  return WARNA_PRIORITAS[kode] ?? 'var(--color-chart)'
}

function Ringkasan({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold text-ink">{value}</div>
      {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
    </div>
  )
}

export function PrioritasKelurahanDrawer({ data, onClose }: Props) {
  useOverlayClose(true, onClose)

  const chart = useMemo(() => {
    const segmen = data.prioritas
      .filter((row) => row.jumlah > 0)
      .map((row) => ({
        name: row.nama,
        value: row.jumlah,
        color: colorPrioritas(row.kode),
      }))
    if (data.tanpaPrioritas > 0) {
      segmen.push({
        name: 'Tanpa prioritas',
        value: data.tanpaPrioritas,
        color: WARNA_TANPA_PRIORITAS,
      })
    }
    if (data.belumDikunjungi > 0) {
      segmen.push({
        name: 'Belum dikunjungi',
        value: data.belumDikunjungi,
        color: WARNA_BELUM_DIKUNJUNGI,
      })
    }
    return segmen
  }, [data])

  const kosong = chart.length === 0

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label={`Tutup status prioritas Kelurahan ${data.kelurahan}`}
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Status prioritas Kelurahan ${data.kelurahan}`}
        className="absolute inset-y-0 right-0 flex w-full max-w-[70vw] flex-col overflow-hidden border-l border-line bg-surface shadow-elev max-md:max-w-full"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">
              Prioritas Kelurahan {data.kelurahan}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Berdasarkan catatan kunjungan rumah terbaru per warga.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-2">
            <Ringkasan
              label="Total warga"
              value={data.total}
              hint="basis persentase"
            />
            <Ringkasan label="Sudah dikunjungi" value={data.dikunjungi} />
            <Ringkasan
              label="Belum dikunjungi"
              value={data.belumDikunjungi}
              hint="prioritas belum diketahui"
            />
            <Ringkasan
              label="Punya prioritas"
              value={data.denganPrioritas}
              hint="≥1 prioritas tercatat"
            />
            <Ringkasan
              label="Tanpa prioritas"
              value={data.tanpaPrioritas}
              hint="sudah dikunjungi"
            />
          </div>

          <h3 className="mt-6 text-sm font-bold text-ink">
            Komposisi prioritas
          </h3>
          {kosong ? (
            <p className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-6 text-center text-xs text-muted">
              Belum ada warga atau catatan kunjungan di kelurahan ini.
            </p>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <DonutChart
                  data={chart}
                  size={190}
                  thickness={26}
                  withLabels
                  labelsType="percent"
                  chartLabel={`${data.total} warga`}
                  valueFormatter={(value) => `${value} warga`}
                  tooltipDataSource="segment"
                />
              </div>
              <ul className="w-full space-y-2">
                {chart.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-2">
                      {item.name}
                    </span>
                    <span className="font-semibold text-ink">{item.value}</span>
                    <span className="text-muted">warga</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="mt-6 text-sm font-bold text-ink">
            Rincian per prioritas
          </h3>
          <p className="mt-1 text-[11px] text-muted">
            Persen dihitung dari seluruh warga kelurahan ({data.total} jiwa),
            bukan dari warga yang sudah dikunjungi.
          </p>
          <div className="mt-3 space-y-3">
            {data.prioritas.length === 0 ? (
              <p className="text-xs text-muted">
                Belum ada prioritas aktif di menu Prioritas.
              </p>
            ) : (
              data.prioritas.map((row) => (
                <div
                  key={row.kode}
                  className="rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: colorPrioritas(row.kode) }}
                      />
                      <span className="text-sm font-semibold text-ink">
                        {row.nama}
                      </span>
                    </div>
                    <span className="text-xs text-muted">
                      <b className="text-ink">{row.pct}%</b> · {row.jumlah}{' '}
                      warga
                    </span>
                  </div>
                  <ProgressBar
                    value={row.pct}
                    barColor={colorPrioritas(row.kode)}
                    className="mt-2"
                  />
                  {row.warga.length === 0 ? (
                    <p className="mt-2 text-[11px] text-muted">
                      Belum ada warga dengan prioritas ini.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {row.warga.map((w, i) => (
                        <li
                          key={`${w.ref}-${i}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]"
                        >
                          <Link
                            to="/sasaran/$ref"
                            params={{ ref: w.ref }}
                            className="font-semibold text-accent hover:text-accent-hover"
                          >
                            {w.nama}
                          </Link>
                          <span className="text-muted">
                            kunjungan {w.tanggal ? fmtDate(w.tanggal) : '—'}
                          </span>
                        </li>
                      ))}
                      {row.wargaLainnya > 0 ? (
                        <li className="text-[11px] text-muted">
                          +{row.wargaLainnya} warga lain
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>

          {/* <div className="mt-5 rounded-lg border border-line bg-surface-2 p-3 text-[11px] text-muted">
            <p>
              Satu warga bisa punya lebih dari satu prioritas. Karena itu jumlah
              persen di donut bisa melebihi 100% dan tidak sama dengan
              persentase tiap baris di atas.
            </p>
            <p className="mt-1">
              Warga yang belum pernah dikunjungi tidak masuk hitungan prioritas
              mana pun — datanya belum ada, bukan berarti tanpa prioritas.
            </p>
          </div>*/}
        </div>
      </section>
    </div>
  )
}
