"use client";

import { useEffect, useRef } from "react";
import { HiCheck } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

/**
 * A small checkbox; "mixed" draws a dash, for a partial select-all. A native
 * checkbox, transparent over the drawn box, so it keeps the platform's
 * keyboard and assistive-technology behavior.
 */
export default function SelectBox({
  checked,
  label,
  onToggle,
}: Readonly<{
  checked: boolean | "mixed";
  label: string;
  onToggle: () => void;
}>) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Only settable from script: there is no attribute for it.
    if (input.current) input.current.indeterminate = checked === "mixed";
  }, [checked]);
  return (
    <span
      className={twMerge(
        "relative flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800",
        checked
          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
          : "border-gray-400 bg-white hover:border-blue-500 dark:border-gray-500 dark:bg-gray-800"
      )}
    >
      <input
        ref={input}
        type="checkbox"
        checked={checked === true}
        aria-label={label}
        title={label}
        // Selecting must not also open, expand or drag what holds it.
        onClick={(event) => event.stopPropagation()}
        onChange={onToggle}
        className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
      />
      {checked === true && <HiCheck className="pointer-events-none h-3 w-3" />}
      {checked === "mixed" && (
        <span className="pointer-events-none h-0.5 w-2 rounded bg-white" />
      )}
    </span>
  );
}
