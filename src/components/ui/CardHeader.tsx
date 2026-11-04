import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface CardHeaderProps {
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  className?: string
}

export function CardHeader({
  title,
  sub,
  actions,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-2.5',
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {sub ? <p className="mt-1 max-md:mr-5.5 text-justify sm:text-left text-xs text-muted">{sub}</p> : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
