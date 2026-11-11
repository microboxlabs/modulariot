import { twMerge } from "tailwind-merge";

/**
 * A count on a constellation icon, drawn like the geographic view's marker
 * counts (`PinCountLayer`): black on yellow, white border, below and to the
 * left of the icon.
 */
export default function ConstellationCount({
  value,
  label,
  className,
}: Readonly<{ value: number; label: string; className?: string }>) {
  return (
    <span
      aria-label={label}
      title={label}
      className={twMerge(
        "absolute -bottom-1 -left-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-md border-2 border-white bg-yellow-300 px-1 text-[11px] font-semibold leading-none text-black shadow-sm",
        className
      )}
    >
      {value}
    </span>
  );
}
