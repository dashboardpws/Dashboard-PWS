import { forwardRef } from 'react'
import { Button as MantineButton } from '@mantine/core'
import type { ButtonProps as MantineButtonProps } from '@mantine/core'
import type { ButtonVariant, ButtonSize } from '@/lib/utils'
import { buttonClass, cn } from '@/lib/utils'

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'color' | 'size'
> {
  variant?: ButtonVariant
  size?: ButtonSize
  mantineProps?: MantineButtonProps
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      type = 'button',
      className,
      children,
      disabled,
      mantineProps,
      ...props
    },
    ref,
  ) => {
    return (
      <MantineButton
        ref={ref}
        type={type}
        disabled={disabled}
        // `unstyled` mencabut style bawaan Mantine (warna biru default & radius Mantine hilang)
        unstyled
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border font-bold transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          buttonClass(variant, size),
          className,
        )}
        styles={{
          root: {
            // Mengunci font-size & line-height secara eksplisit agar ukuran `sm` tidak kebesaran
            fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
            lineHeight: size === 'sm' ? '1rem' : '1.25rem',
          },
        }}
        {...mantineProps}
        {...props}
      >
        {children}
      </MantineButton>
    )
  },
)

Button.displayName = 'Button'
