"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

type BadgeSelectGroupProps = Readonly<{
  options: readonly string[];
  value?: string;
  onChange: (value: string) => void;
  /** Accessible name for the radiogroup, e.g. "Organization size" */
  name: string;
  /** When this option is the selected one, its pill becomes an inline text input (e.g. "Otro") instead of a static button. */
  otherOption?: string;
  otherValue?: string;
  onOtherValueChange?: (value: string) => void;
  otherPlaceholder?: string;
}>;

const PILL_SHAPE =
  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors";
const PILL_SELECTED = "border-blue-700 bg-blue-700 text-white";
const PILL_UNSELECTED =
  "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:bg-gray-700";

/** Pill-shaped input that grows/shrinks to fit its own text, measured via an
 * invisible mirror span sharing the same box model as the visible input. */
function OtherPillInput({
  value,
  onChange,
  placeholder,
}: Readonly<{
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}>) {
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    setWidth(mirrorRef.current?.offsetWidth);
  }, [value, placeholder]);

  // This component only mounts once "Otro" becomes the selected option, so
  // focusing on mount is exactly focusing right after the user picks it.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <span className="relative inline-block">
      <span
        ref={mirrorRef}
        aria-hidden="true"
        className={twMerge(
          PILL_SHAPE,
          PILL_SELECTED,
          "invisible absolute left-0 top-0 whitespace-pre"
        )}
      >
        {value || placeholder}
      </span>
      <input
        ref={inputRef}
        type="text"
        role="radio"
        aria-checked
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={width ? { width: `${width + 2}px` } : undefined}
        className={twMerge(
          PILL_SHAPE,
          PILL_SELECTED,
          "placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:placeholder-blue-300"
        )}
      />
    </span>
  );
}

/** Single-select group of pill/badge buttons, wrapping onto multiple lines. */
export default function BadgeSelectGroup({
  options,
  value,
  onChange,
  name,
  otherOption,
  otherValue,
  onOtherValueChange,
  otherPlaceholder,
}: BadgeSelectGroupProps) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option === value;

        if (selected && option === otherOption) {
          return (
            <OtherPillInput
              key={option}
              value={otherValue ?? ""}
              onChange={onOtherValueChange}
              placeholder={otherPlaceholder ?? option}
            />
          );
        }

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={twMerge(
              PILL_SHAPE,
              selected ? PILL_SELECTED : PILL_UNSELECTED
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
