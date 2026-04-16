"use client";

import { createPortal } from "react-dom";
import { HiCheck } from "react-icons/hi";
import { Button } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import { usePickerDropdown } from "../../hooks";

export interface IconOption<T extends string = string> {
  /** The icon value/key */
  value: T;
  /** Display label for the icon */
  label: string;
  /** React icon component */
  icon: React.ComponentType<{ className?: string }>;
}

interface IconPickerDropdownProps<T extends string = string> {
  /** Currently selected icon value */
  value: T;
  /** Callback when icon changes */
  onChange: (icon: T) => void;
  /** Available icon options */
  options: IconOption<T>[];
  /** Tooltip text for the trigger button */
  title?: string;
  /** Additional classes for the trigger button */
  className?: string;
}

/**
 * Custom icon picker dropdown (portal-based)
 * Generic component that works with any icon set
 */
export function IconPickerDropdown<T extends string = string>({
  value,
  onChange,
  options,
  title = "Select icon",
  className,
}: Readonly<IconPickerDropdownProps<T>>) {
  const { isOpen, position, triggerRef, toggle, close } = usePickerDropdown({
    portalDataAttribute: "data-iconpicker-portal",
  });

  const selectedOption = options.find((opt) => opt.value === value);
  const SelectedIcon = selectedOption?.icon;

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        color="alternative"
        size="sm"
        onClick={toggle}
        className={twMerge(
          "p-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
          "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600",
          "hover:border-gray-400 dark:hover:border-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-primary-300",
          className
        )}
        title={title}
      >
        {SelectedIcon && (
          <SelectedIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        )}
      </Button>
      {isOpen &&
        position &&
        createPortal(
          <div
            data-iconpicker-portal
            className="no-drag fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-30"
            style={{ top: position.top, left: position.left }}
          >
            {options.map((iconOpt) => {
              const Icon = iconOpt.icon;
              return (
                <button
                  key={iconOpt.value}
                  type="button"
                  onClick={() => {
                    onChange(iconOpt.value);
                    close();
                  }}
                  className={twMerge(
                    "w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs transition-colors",
                    "hover:bg-gray-100 dark:hover:bg-gray-700",
                    value === iconOpt.value && "bg-gray-50 dark:bg-gray-700/50"
                  )}
                >
                  <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300 shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {iconOpt.label}
                  </span>
                  {value === iconOpt.value && (
                    <HiCheck className="ml-auto h-3 w-3 text-primary-500" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
