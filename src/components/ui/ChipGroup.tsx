import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Chip } from './Chip'
import type { ChipProps } from './Chip'

export interface ChipOption {
  value: string
  label: ReactNode
}

export interface ChipGroupProps {
  options: ChipOption[]
  selected: ReadonlySet<string> | string[] | string
  onToggle: (value: string) => void
  dark?: boolean
  className?: string
  chipProps?: Partial<ChipProps>
  /** Opsi jika ingin Chip di-scroll horizontal pada mobile agar tidak banyak baris */
  scrollableOnMobile?: boolean
}

export function ChipGroup({
  options,
  selected,
  onToggle,
  dark,
  className,
  chipProps,
  scrollableOnMobile = false,
}: ChipGroupProps) {
  const has = (v: string) =>
    typeof selected === 'string'
      ? selected === v
      : Array.from(selected).includes(v)

  return (
    <div
      className={cn(
        // Gap dirapatkan dari gap-2 (8px) menjadi gap-1.5 (6px)
        'flex gap-1.5',
        scrollableOnMobile
          ? 'overflow-x-auto pb-1 no-scrollbar -mx-1 px-1'
          : 'flex-wrap',
        className,
      )}
    >
      {options.map((opt) => (
        <Chip
          key={opt.value}
          selected={has(opt.value)}
          dark={dark}
          onClick={() => onToggle(opt.value)}
          {...chipProps}
        >
          {opt.label}
        </Chip>
      ))}
    </div>
  )
}