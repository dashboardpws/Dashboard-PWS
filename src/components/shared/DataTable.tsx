import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from 'react'
import { cn, CARD_SHELL } from '@/lib/utils'
import { Pagination } from '@/components/ui/Pagination'

/**
 * Sel `<td>` setelah normalisasi. Tujuh tabel menulis `px-3 py-2.5` tangan
 * di tiap sel (37 seluruhnya) dengan padding yang mulai mengembar; Td menjaga
 * satu nilai bawaan dan pemanggil hanya menambah selisihnya
 * (`whitespace-nowrap`, `text-muted`, dsb).
 */
export function Td({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5', className)} {...props} />
}

/**
 * Baris `<tr>` tabel desktop DataTable: garis antar baris + highlight hover.
 * Highlight bisa dimatikan (`hover={false}`) untuk tabel "read-only" yang
 * barisnya bukan tombol.
 */
export function Tr({
  hover = true,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={cn(
        'border-b border-surface-2 last:border-none',
        hover && 'hover:bg-surface-2',
        className,
      )}
      {...props}
    />
  )
}

/** Baris kartu mobile yang menyalin garis antar-baris tabel desktopnya. */
export function MobileRow({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-b border-surface-2 last:border-none px-3.5 py-3',
        className,
      )}
      {...props}
    />
  )
}

export interface DataTableColumn {
  key: string
  label?: ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn[]
  rows: T[]
  renderRow: (row: T, index: number) => ReactNode
  renderMobileRow?: (row: T, index: number) => ReactNode
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  toolbar?: ReactNode
  info?: ReactNode
  emptyMessage?: ReactNode
  page?: number
  canPrev?: boolean
  canNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  className?: string
}

interface SortThProps {
  col: DataTableColumn
  active: boolean
  sortDir: 'asc' | 'desc'
  onSort?: (key: string) => void
}

function SortTh({ col, active, sortDir, onSort }: SortThProps) {
  const sortable = col.sortable && onSort
  const handleSort = () => {
    if (sortable) onSort(col.key)
  }
  return (
    <th
      key={col.key}
      onClick={sortable ? handleSort : undefined}
      onKeyDown={
        sortable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSort()
              }
            }
          : undefined
      }
      tabIndex={sortable ? 0 : undefined}
      role={sortable ? 'button' : undefined}
      aria-sort={
        sortable
          ? active
            ? sortDir === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
          : undefined
      }
      className={cn(
        'whitespace-nowrap border-b border-line-2 bg-surface-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted',
        sortable &&
          'cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-accent',
        col.headerClassName,
      )}
    >
      <span
        className={cn('inline-flex items-center gap-1', active && 'text-ink')}
      >
        {col.label}
        {sortable ? (
          active ? (
            sortDir === 'asc' ? (
              <ArrowUp size={12} />
            ) : (
              <ArrowDown size={12} />
            )
          ) : (
            <ArrowUpDown size={12} className="opacity-50" />
          )
        ) : null}
      </span>
    </th>
  )
}

/** Sel sungguhan kosong yang umum untuk kedua tabel internal DataTable. */
function TempatKosong({
  columns,
  children,
}: {
  columns: number
  children: ReactNode
}) {
  return (
    <td colSpan={columns} className="px-3 py-5 text-center text-muted">
      {children}
    </td>
  )
}

export function DataTable<T>({
  columns,
  rows,
  renderRow,
  renderMobileRow,
  sortKey,
  sortDir = 'asc',
  onSort,
  toolbar,
  info,
  emptyMessage,
  page,
  canPrev,
  canNext,
  onPrev,
  onNext,
  className,
}: DataTableProps<T>) {
  const hasPagination = page !== undefined || onPrev || onNext
  return (
    <div className={cn('mt-3.5 overflow-hidden', CARD_SHELL, className)}>
      {toolbar ? (
        <div className="border-b border-line-2 px-3.5 py-3">{toolbar}</div>
      ) : null}
      {renderMobileRow ? (
        <>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-xs max-md:hidden">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <SortTh
                      key={col.key}
                      col={col}
                      active={sortKey === col.key}
                      sortDir={sortDir}
                      onSort={onSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row, i) => renderRow(row, i))
                ) : (
                  <tr>
                    <TempatKosong columns={columns.length}>
                      {emptyMessage ?? 'Tidak ada data'}
                    </TempatKosong>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {rows.length > 0 ? (
              rows.map((row, i) => renderMobileRow(row, i))
            ) : (
              <div className="px-3 py-5 text-center text-muted text-xs">
                {emptyMessage ?? 'Tidak ada data'}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {columns.map((col) => (
                  <SortTh
                    key={col.key}
                    col={col}
                    active={sortKey === col.key}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, i) => renderRow(row, i))
              ) : (
                <tr>
                  <TempatKosong columns={columns.length}>
                    {emptyMessage ?? 'Tidak ada data'}
                  </TempatKosong>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {hasPagination ? (
        <Pagination
          info={info}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={onPrev}
          onNext={onNext}
        />
      ) : null}
    </div>
  )
}
