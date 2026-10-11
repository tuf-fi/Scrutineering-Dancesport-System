import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

const variants = {
  primary: 'bg-gold-400 text-black hover:bg-gold-300 active:bg-gold-500',
  secondary:
    'border border-brown-800 text-brown-900 hover:bg-brown-50 active:bg-brown-100',
  ghost: 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
  danger: 'bg-danger text-white hover:bg-[#9a1f19] active:bg-[#821a15]',
} as const

const sizes = {
  sm: 'h-9 px-3 text-small',
  md: 'h-11 px-4 text-body',
  lg: 'h-12 px-6 text-body',
  // Adjudicator phones: 56px minimum touch target
  xl: 'h-16 px-8 text-title',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
