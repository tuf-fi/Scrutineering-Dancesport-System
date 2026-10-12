import logo from '../assets/logo.png'
import { cn } from '../lib/cn.ts'

const sizes = {
  // Top bars
  sm: 'h-9',
  // Sidebar, collapsed rail
  md: 'h-14',
  // Sidebar header
  xl: 'h-20',
  // Sign-in pages
  lg: 'h-24',
} as const

export function Brand({ size = 'sm', className }: { size?: keyof typeof sizes; className?: string }) {
  return <img src={logo} alt="BIS" className={cn('w-auto select-none', sizes[size], className)} />
}
