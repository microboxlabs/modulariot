import type { ReactNode } from "react";
import { CHANGED } from "./changed";

const PILL =
  "inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-2 py-0.5 font-medium text-gray-900 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white";
const BARE =
  "border-0 bg-transparent p-0 text-inherit outline-none focus:ring-0 [font:inherit]";

/** The inline editable token the sheet's sentences are made of. */
export function Pill({
  changed = false,
  className = "",
  children,
}: Readonly<{ changed?: boolean; className?: string; children: ReactNode }>) {
  return (
    <span className={`${PILL} ${changed ? CHANGED : ""} ${className}`}>
      {children}
    </span>
  );
}

export interface PillOption {
  value: string;
  label: string;
}

export function PillSelect({
  value,
  options,
  onChange,
  changed,
  disabled,
  ariaLabel,
  className,
}: Readonly<{
  value: string;
  options: PillOption[];
  onChange: (value: string) => void;
  changed?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}>) {
  return (
    <Pill changed={changed} className={className}>
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${BARE} pr-1`}
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
            className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
          >
            {o.label}
          </option>
        ))}
      </select>
    </Pill>
  );
}

export function PillNumber({
  value,
  onChange,
  unit,
  changed,
  disabled,
  ariaLabel,
  width = "3.4ch",
}: Readonly<{
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  changed?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  width?: string;
}>) {
  return (
    <Pill changed={changed}>
      <input
        type="number"
        aria-label={ariaLabel}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        style={{ width }}
        className={`${BARE} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      {unit && <span className="text-gray-500 dark:text-gray-400">{unit}</span>}
    </Pill>
  );
}
