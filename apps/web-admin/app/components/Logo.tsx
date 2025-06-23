import Link from 'next/link'
import { Zap } from 'lucide-react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  }

  const iconSizes = {
    sm: 20,
    md: 24,
    lg: 28
  }

  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <Zap 
          size={iconSizes[size]} 
          className="text-blue-500 fill-current" 
        />
      </div>
      <span className={`font-semibold text-slate-900 dark:text-slate-100 tracking-tight ${sizeClasses[size]}`}>
        ModularIoT
      </span>
    </Link>
  )
} 