import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { Button as MantineButton } from '@mantine/core'
import type { ButtonVariant, ButtonSize } from '@/lib/utils'

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function ButtonLink({
  variant = 'default',
  size = 'md',
  className,
  ...link
}: ButtonLinkProps) {
  return (
    <MantineButton
      component={Link as any}
      size={size}
      variant={variant}
      className={className}
      {...(link as Record<string, unknown>)}
    />
  )
}
