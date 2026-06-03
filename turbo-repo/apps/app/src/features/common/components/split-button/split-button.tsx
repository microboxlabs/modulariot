"use client";

import { useState, useEffect, useRef } from "react";
import { Tooltip } from "flowbite-react";
import { HiChevronDown } from "react-icons/hi2";
import type { ReactNode } from "react";

function MaybeTooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip content={content} placement="bottom">
      <div>{children}</div>
    </Tooltip>
  );
}

export type SplitButtonAction = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
};

export type SplitButtonProps = Readonly<{
  primary: SplitButtonAction;
  secondaryActions: SplitButtonAction[];
  secondaryLabel?: ReactNode;
  size?: "sm" | "md";
  overlay?: boolean;
  disabled?: boolean;
  primaryDisabled?: boolean;
  tooltip?: ReactNode;
  primaryTooltip?: ReactNode;
}>;

export default function SplitButton({
  primary,
  secondaryActions,
  secondaryLabel,
  size = "sm",
  overlay = false,
  disabled = false,
  primaryDisabled = false,
  tooltip,
  primaryTooltip,
}: SplitButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dropdownOpen]);

  const sizeClasses =
    size === "sm"
      ? "h-7 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
      : "h-10 text-sm px-3 py-2";

  const secondaryBase = `flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses}`;

  return (
    <>
      {overlay && dropdownOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close dropdown"
          className="fixed inset-0 z-30 transition-all duration-300 opacity-100 visible backdrop-blur-[10px] bg-black/30"
          onClick={() => setDropdownOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") setDropdownOpen(false);
          }}
        />
      )}
      <div className={`flex items-stretch ${size === "sm" ? "ml-1 h-7 sm:h-9" : "h-10"}`}>
        {/* Secondary: single action button OR chevron dropdown */}
        {secondaryActions.length === 1 && !secondaryLabel && (
          <MaybeTooltip content={disabled ? tooltip : undefined}>
            <button
              type="button"
              onClick={secondaryActions[0].onClick}
              disabled={disabled}
              className={`${secondaryBase} rounded-lg rounded-r-none`}
            >
              {secondaryActions[0].icon}
              {secondaryActions[0].label}
            </button>
          </MaybeTooltip>
        )}
        {(secondaryActions.length > 1 || secondaryLabel) && (
          <div ref={dropdownRef} className={`relative ${overlay ? "z-40" : ""}`}>
            <MaybeTooltip content={disabled ? tooltip : undefined}>
              <button
                type="button"
                onClick={() => setDropdownOpen((p) => !p)}
                disabled={disabled}
                className={`${secondaryBase} rounded-lg rounded-r-none`}
              >
                {secondaryLabel && (
                  <span className="hidden lg:block whitespace-nowrap">
                    {secondaryLabel}
                  </span>
                )}
                <HiChevronDown
                  className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </MaybeTooltip>
            {dropdownOpen && (
              <div className={`absolute top-full mt-1 left-0 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden ${overlay ? "z-40" : "z-50"}`}>
                {secondaryActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      action.onClick();
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Primary action button */}
        <MaybeTooltip content={(disabled || primaryDisabled) ? primaryTooltip : undefined}>
          <button
            type="button"
            onClick={primary.onClick}
            disabled={disabled || primaryDisabled}
            className={`flex items-center gap-1.5 font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${
              secondaryActions.length > 0 || secondaryLabel
                ? "rounded-lg rounded-l-none"
                : "rounded-lg"
            }`}
          >
            {primary.icon}
            {primary.label}
          </button>
        </MaybeTooltip>
      </div>
    </>
  );
}
