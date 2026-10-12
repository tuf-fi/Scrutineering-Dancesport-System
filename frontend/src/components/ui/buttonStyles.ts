import { cn } from '../../lib/cn.ts'

export const buttonVariants = {
  primary: 'bg-gold-400 text-black hover:bg-gold-300 active:bg-gold-500',
  secondary: 'border border-neutral-300 text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100',
  ghost: 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
  danger: 'bg-danger text-white hover:bg-[#9a1f19] active:bg-[#821a15]',
} as const

export const buttonSizes = {
  sm: 'h-8 px-3 text-small',
  md: 'h-10 px-4 text-small',
  lg: 'h-11 px-5 text-body',
  // Adjudicator phones: 56px minimum touch target, large legible labels
  xl: 'h-16 px-8 text-2xl',
} as const

export type ButtonVariant = keyof typeof buttonVariants
export type ButtonSize = keyof typeof buttonSizes

export function buttonStyles(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-[-0.005em] transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-40',
    buttonVariants[variant],
    buttonSizes[size],
    className,
  )
}
