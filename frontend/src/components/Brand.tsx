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

// plate: false on dark surfaces, where the logo's black ground blends into the backdrop
export function Brand({ size = 'sm', className, plate = true }: { size?: keyof typeof sizes; className?: string; plate?: boolean }) {
  // The logo has white lettering on black, so on light surfaces it sits on a black plate
  const img = <img src={logo} alt="BIS" className={cn('w-auto select-none', sizes[size], !plate && 'mix-blend-screen', !plate && className)} />
  if (!plate) return img
  return <span className={cn('inline-flex rounded-md bg-black px-2 py-1', className)}>{img}</span>
}
