"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HiXMark } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

type BadgeMultiSelectGroupProps = Readonly<{
  options: readonly string[];
  value?: readonly string[];
  onChange: (value: string[]) => void;
  /** Accessible name for the group, e.g. "What do you want to monitor?" */
  name: string;
  /** When this option is selected, its pill becomes an inline text input (e.g. "Otros") instead of a static button. */
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

// Only the text itself needs measuring here — unlike badge-select-group's
// standalone pill-input, this input sits inside an already-padded/bordered
// wrapper span, so the mirror just needs to match the input's own (padding-
// free) box, not the whole pill.
const INNER_TEXT_SHAPE = "py-0.5 text-xs font-medium";

/** Text input that grows/shrinks to fit its own content, measured via an
 * invisible mirror span sharing the same box model as the visible input. */
function OtherInlineInput({
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

  // This component only mounts once "Otros" becomes selected, so focusing
  // on mount is exactly focusing right after the user picks it.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <span className="relative inline-block">
      <span
        ref={mirrorRef}
        aria-hidden="true"
        className={twMerge(
          INNER_TEXT_SHAPE,
          "invisible absolute left-0 top-0 whitespace-pre"
        )}
      >
        {value || placeholder}
      </span>
      <input
        ref={inputRef}
        type="text"
        role="checkbox"
        aria-checked
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={width ? { width: `${width + 2}px` } : undefined}
        className={twMerge(
          INNER_TEXT_SHAPE,
          "bg-transparent placeholder-blue-200 focus:outline-none dark:placeholder-blue-300"
        )}
      />
    </span>
  );
}

/** Multi-select group of pill/badge buttons, wrapping onto multiple lines. */
export default function BadgeMultiSelectGroup({
  options,
  value,
  onChange,
  name,
  otherOption,
  otherValue,
  onOtherValueChange,
  otherPlaceholder,
}: BadgeMultiSelectGroupProps) {
  const selectedValues = value ?? [];

  function toggle(option: string) {
    onChange(
      selectedValues.includes(option)
        ? selectedValues.filter((v) => v !== option)
        : [...selectedValues, option]
    );
  }

  return (
    <fieldset
      aria-label={name}
      className="m-0 flex flex-wrap gap-2 border-0 p-0"
    >
      {options.map((option) => {
        const selected = selectedValues.includes(option);

        if (selected && option === otherOption) {
          return (
            <span
              key={option}
              className={twMerge(
                PILL_SHAPE,
                PILL_SELECTED,
                "inline-flex items-center gap-1 py-0.5 pr-1"
              )}
            >
              <OtherInlineInput
                value={otherValue ?? ""}
                onChange={onOtherValueChange}
                placeholder={otherPlaceholder ?? option}
              />
              {/* The pill itself is now a text field, not a toggle button —
                  this is the only way left to deselect "Otros". */}
              <button
                type="button"
                aria-label={option}
                onClick={() => toggle(option)}
                className="shrink-0 rounded-full p-0.5 hover:bg-blue-800"
              >
                <HiXMark className="h-3 w-3" />
              </button>
            </span>
          );
        }

        return (
          <label
            key={option}
            className={twMerge(
              PILL_SHAPE,
              selected ? PILL_SELECTED : PILL_UNSELECTED,
              "cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-blue-300 has-focus-visible:ring-offset-1"
            )}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => toggle(option)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </fieldset>
  );
}
