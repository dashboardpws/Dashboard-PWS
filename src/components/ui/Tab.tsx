import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(
  ({ active, type = 'button', className, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        'cursor-pointer rounded-full border px-3.5 py-1.5 text-xs! font-medium transition-colors',
        active
          ? 'border-accent-border bg-accent-light font-semibold text-accent'
          : 'border-line bg-surface text-muted',
        className,
      )}
      {...props}
    />
  ),
)

Tab.displayName = 'Tab'
