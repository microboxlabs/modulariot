export default function Fadeable({
  isActive,
  children,
  className,
  delayMs,
}: {
  readonly isActive: boolean;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly delayMs?: number;
}) {
  return (
    <div
      className={`gap-2 px-4 animate-fade-in-opacity opacity-0 transition-opacity ${className}`}
      style={isActive ? { animationDelay: `${delayMs}ms` } : {}}
    >
      {children}
    </div>
  );
}
