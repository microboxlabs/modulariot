import { twMerge } from "tailwind-merge";

/**
 * A flat, dependency-free version of the orb: a coloured circle, optionally
 * with two plain white eyes. Used where a live WebGL `<View>` isn't worth it —
 * older chat messages — and, with `plain`, as the "the character has left"
 * placeholder on a dock button whose worker is currently active in the chat.
 */
export function CssOrb({
  color,
  className,
  plain = false,
  look = { x: 0, y: 0.15 },
}: Readonly<{
  color: string;
  className?: string;
  plain?: boolean;
  look?: { x: number; y: number };
}>) {
  const ex = 30 + look.x * 8;
  const ey = 42 - look.y * 7;
  return (
    <svg
      viewBox="0 0 100 100"
      className={twMerge("shrink-0", className)}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="48" fill={color} />
      {!plain && (
        <>
          <circle cx={ex} cy={ey} r="13" fill="#fff" />
          <circle cx={100 - ex} cy={ey} r="13" fill="#fff" />
        </>
      )}
    </svg>
  );
}
