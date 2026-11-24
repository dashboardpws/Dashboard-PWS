import type { LabelHTMLAttributes, ReactNode } from 'react'
import { FieldHint } from './FieldHint'
import { cn } from '@/lib/utils'

export interface FormFieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  invalid?: boolean
  htmlFor?: string
  errorId?: string
}

export function FormField({
  label,
  required,
  hint,
  error,
  invalid,
  className,
  children,
  htmlFor,
  errorId,
  ...props
}: FormFieldProps) {
  return (
    <label
      htmlFor={htmlFor}
      aria-invalid={invalid}
      aria-describedby={invalid && errorId ? errorId : undefined}
      className={cn(
        'grid gap-1.5 text-xs font-semibold text-ink',
        invalid &&
          '[&>input]:border-[var(--color-danger-border)] [&>select]:border-[var(--color-danger-border)] [&>textarea]:border-[var(--color-danger-border)]',
        className,
      )}
      {...props}
    >
      <span className="flex items-start gap-1">
        <span>
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </span>
        {hint ? <FieldHint text={hint} /> : null}
      </span>
      {children}
      {error ? (
        <span
          id={errorId}
          role={invalid ? 'alert' : undefined}
          className={cn(
            'text-[11px] font-semibold text-danger',
            !invalid && 'hidden',
          )}
        >
          {error}
        </span>
      ) : null}
    </label>
  )
}
