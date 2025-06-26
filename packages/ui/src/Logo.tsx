import Image from 'next/image';

/**
 * Logo component for ModularIoT apps.
 * @param size - One of 'xs', 'sm', 'md', 'lg'. Controls logo size.
 * @param className - Additional CSS classes.
 * @param src - Image source path. Defaults to '/headlogo.svg'.
 */
export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  src?: '/headlogo.svg' | '/logo.svg';
}

export function Logo({ size = 'md', className = '', src = "/headlogo.svg" }: LogoProps) {
  const imageSizes = {
    xs: { width: 32, height: 32 },
    sm: { width: 120, height: 32 },
    md: { width: 140, height: 36 },
    lg: { width: 160, height: 40 }
  };

  return (
    <span className={`flex items-center ${className}`}>
      <Image
        src={src}
        alt="ModularIoT"
        width={imageSizes[size].width}
        height={imageSizes[size].height}
        priority
        style={{ display: 'inline-block' }}
      />
    </span>
  );
} 