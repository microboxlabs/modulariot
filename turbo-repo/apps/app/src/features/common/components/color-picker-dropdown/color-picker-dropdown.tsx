"use client";

import { createPortal } from "react-dom";
import { HiCheck } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePickerDropdown } from "../../hooks";

export interface ColorOption<T extends string = string> {
  /** The color value/key */
  value: T;
  /** Display label for the color */
  label: string;
  /** Tailwind class for the color dot (e.g., "bg-emerald-500") */
  dotClass: string;
}

interface ColorPickerDropdownProps<T extends string = string> {
  /** Currently selected color value */
  value: T;
  /** Callback when color changes */
  onChange: (color: T) => void;
  /** Available color options */
  options: ColorOption<T>[];
  /** Tooltip text for the trigger button */
  title?: string;
  /** Additional classes for the trigger button */
  className?: string;
}

/**
 * Custom color picker dropdown with color circles (portal-based)
 * Generic component that works with any color palette
 */
export function ColorPickerDropdown<T extends string = string>({
  value,
  onChange,
  options,
  title = "Cambiar color",
  className,
}: Readonly<ColorPickerDropdownProps<T>>) {
  const { isOpen, position, triggerRef, toggle, close } = usePickerDropdown({
    portalDataAttribute: "data-colorpicker-portal",
  });

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={twMerge(
          "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
          "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600",
          "hover:border-gray-400 dark:hover:border-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-primary-300",
          className
        )}
        title={title}
      >
        <span
          className={twMerge(
            "w-4 h-4 rounded-full",
            selectedOption?.dotClass ?? "bg-gray-400"
          )}
        />
      </button>
      {isOpen &&
        position &&
        createPortal(
          <div
            data-colorpicker-portal
            className="no-drag fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-30"
            style={{ top: position.top, left: position.left }}
          >
            {options.map((colorOpt) => (
              <button
                key={colorOpt.value}
                type="button"
                onClick={() => {
                  onChange(colorOpt.value);
                  close();
                }}
                className={twMerge(
                  "w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  value === colorOpt.value && "bg-gray-50 dark:bg-gray-700/50"
                )}
              >
                <span
                  className={twMerge(
                    "w-3 h-3 rounded-full shrink-0",
                    colorOpt.dotClass
                  )}
                />
                <span className="text-gray-700 dark:text-gray-300">
                  {colorOpt.label}
                </span>
                {value === colorOpt.value && (
                  <HiCheck className="ml-auto h-3 w-3 text-primary-500" />
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
