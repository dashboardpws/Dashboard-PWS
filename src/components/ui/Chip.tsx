import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  dark?: boolean
  size?: 'md' | 'sm'
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  (
    { selected, dark, size = 'md', type = 'button', className, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        'cursor-pointer rounded-full border text-ink-2 font-semibold transition-colors',
        // Touch Target & Hover (Mobile vs Desktop)
        'touch-manipulation active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        
        // Ukuran Responsif (Mobile First -> Desktop / md:)
        size === 'md'
          ? 'px-3 py-2 text-sm! min-h-9.5 md:px-3.5 md:py-1.5 md:min-h-9 md:text-sm'
          : 'px-2.5 py-1.5 text-sm! min-h-8 md:px-3 md:py-1 md:min-h-7 md:text-sm',

        selected &&
          (dark
            ? 'border-ink/50 bg-ink text-on-accent'
            : 'border-accent/50 bg-accent text-on-accent'),
        className,
      )}
      {...props}
    />
  ),
)

Chip.displayName = 'Chip'
