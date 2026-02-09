"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiCheck } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

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
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const SelectedIcon = selectedOption?.icon;

  // Calculate position before opening
  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 120,
      });
    }
    setIsOpen(true);
  };

  // Reset position when closed
  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-iconpicker-portal]") &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className={twMerge(
          "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
          "bg-gray-100 dark:bg-gray-900/50 hover:bg-gray-200 dark:hover:bg-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-primary-300",
          className
        )}
        title={title}
      >
        {SelectedIcon && (
          <SelectedIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        )}
      </button>
      {isOpen &&
        position &&
        createPortal(
          <div
            data-iconpicker-portal
            className="no-drag fixed z-9999 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
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
                    setIsOpen(false);
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
