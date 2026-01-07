export default function Fadeable({
  isActive,
  children,
  className,
  delayMs,
}: {
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
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
