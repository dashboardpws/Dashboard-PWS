import { forwardRef } from 'react'
import { Button as MantineButton } from '@mantine/core'
import type { ButtonProps as MantineButtonProps } from '@mantine/core'
import type { ButtonSize, ButtonVariant } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface ButtonProps
  extends
    Omit<MantineButtonProps, 'size' | 'variant'>,
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      'color' | 'size' | 'style' | 'className'
    > {
  size?: ButtonSize
  variant?: ButtonVariant
  className?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { size = 'md', type = 'button', variant = 'default', className, ...props },
    ref,
  ) => (
    <MantineButton
      ref={ref}
      type={type}
      size={size}
      variant={variant}
      className={cn(
        // Menjaga warna teks tetap gelap (atau sesuai variabel ink) saat hover pada variant ghost/subtle
        'hover:text-ink-1 font-bold',
        className,
      )}
      classNames={{
        // Memberikan gap antara ikon dan teks serta menyelaraskan posisi vertikalnya
        inner: 'gap-2',
        label: 'flex items-center gap-2 font-bold hover:text-inherit',
      }}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
