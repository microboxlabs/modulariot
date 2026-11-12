import { twMerge } from "tailwind-merge";
import type { ConstellationCondition } from "../types/symptoms";

/** Each count in the color of its icon; the center pin is blue. */
const TONE: Record<ConstellationCondition | "onTrip", string> = {
  codeBlack: "bg-black text-white",
  critic: "bg-rose-600 text-white",
  compromised: "bg-rose-300 text-rose-950",
  observation: "bg-white text-rose-600 border-rose-600",
  treatment: "bg-amber-500 text-black",
  stable: "bg-blue-600 text-white",
  onTrip: "bg-blue-600 text-white",
};

/** A count on a constellation icon, below and to the left of it. */
export default function ConstellationCount({
  value,
  label,
  tone,
  className,
}: Readonly<{
  value: number;
  label: string;
  tone: ConstellationCondition | "onTrip";
  className?: string;
}>) {
  return (
    <span
      aria-label={label}
      title={label}
      className={twMerge(
        "absolute -bottom-1 -left-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-md border-2 border-white px-1 text-[11px] font-semibold leading-none shadow-sm dark:border-gray-800",
        TONE[tone],
        className
      )}
    >
      {value}
    </span>
  );
}
