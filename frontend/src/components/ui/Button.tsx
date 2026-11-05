import { useIsMutating } from '@tanstack/react-query'
import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { queryClient } from '../../app/queryClient.ts'
import { buttonStyles, type ButtonSize, type ButtonVariant } from './buttonStyles.ts'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

// A button that sends a form cannot be pressed again while anything is still being saved, so a double tap never saves twice
export function Button({ variant = 'primary', size = 'md', type = 'button', className, disabled, ...props }: ButtonProps) {
  const saving = useIsMutating(undefined, queryClient) > 0
  return <button type={type} className={buttonStyles(variant, size, className)} disabled={disabled || (type === 'submit' && saving)} {...props} />
}

// A navigation link that looks like a button
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonStyles(variant, size, className)} {...props} />
}
