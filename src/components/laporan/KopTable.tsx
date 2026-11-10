import type { ReactNode } from 'react'

export interface KopTableProps<T> {
  headers: string[]
  colSpan: number
  emptyMessage: string
  rows: T[]
  renderRow: (row: T, index: number) => ReactNode
}

export function KopTable<T>({
  headers,
  colSpan,
  emptyMessage,
  rows,
  renderRow,
}: KopTableProps<T>) {
  return (
    <div className="kop-tabel mt-4 overflow-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-line bg-surface-2 px-2.5 py-2 truncate text-left font-semibold uppercase tracking-wider text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-2.5 py-4 truncate text-center text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => renderRow(r, i))
          )}
        </tbody>
      </table>
    </div>
  )
}
