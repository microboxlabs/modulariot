/**
 * Modular IoT brand mark — pure CSS, no SVG.
 *
 * 24px (default) ink-1 square with two inset 8x8 squares: blue-600 top-left,
 * #FFB017 bottom-right. The yellow is a literal art-piece color (legacy from
 * the original Mintral mark that became the Modular IoT identity); it is NOT
 * a platform token, so it's inlined as a hex value.
 *
 * Spec: see design-ref `landing/landing.css` `.brand-mark` rule.
 */
type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 24, className = "" }: BrandMarkProps) {
  // The reference mark is 24px outer, 8px inner squares, 5px offset.
  // Scale linearly from those proportions so callers can resize cleanly.
  const inner = (size * 8) / 24;
  const offset = (size * 5) / 24;
  const radius = (size * 6) / 24;
  const innerRadius = (size * 1.5) / 24;

  return (
    <span
      aria-hidden
      className={`relative inline-block overflow-hidden bg-ink-1 ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <span
        className="absolute bg-blue-600"
        style={{
          width: inner,
          height: inner,
          top: offset,
          left: offset,
          borderRadius: innerRadius,
        }}
      />
      <span
        className="absolute"
        style={{
          width: inner,
          height: inner,
          bottom: offset,
          right: offset,
          borderRadius: innerRadius,
          background: "#FFB017",
        }}
      />
    </span>
  );
}
