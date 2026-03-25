import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const imageSizes = {
    xs: { width: 32, height: 32 },
    sm: { width: 120, height: 32 },
    md: { width: 140, height: 36 },
    lg: { width: 160, height: 40 }
  }

  return (
    <Link href="/" className={`flex items-center ${className}`}>
      <Image
        src="/headlogo.svg"
        alt="ModularIoT"
        width={imageSizes[size].width}
        height={imageSizes[size].height}
        priority
      />
    </Link>
  )
} 