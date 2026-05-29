"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "flowbite-react";
import { HiChevronDown } from "react-icons/hi2";
import type { ReactNode } from "react";

type ReviewAction = {
  id: string;
  label: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  isActive?: boolean;
};

export function ReviewSplitButton({
  primary,
  secondaryActions,
}: Readonly<{
  primary: ReviewAction;
  secondaryActions: ReviewAction[];
}>) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const baseSecondary =
    "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 transition-colors cursor-pointer h-full";

  return (
    <div className="flex items-stretch ml-1 h-7 sm:h-9">
      {secondaryActions.length === 1 && (
        <Button
          color="alternative"
          onClick={secondaryActions[0].onClick}
          className={`${baseSecondary} rounded-lg rounded-r-none `}
        >
          {secondaryActions[0].icon}
          {secondaryActions[0].label}
        </Button>
      )}
      {secondaryActions.length > 1 && (
        <div ref={dropdownRef} className="relative">
          <Button
            type="button"
            onClick={() => setDropdownOpen((p) => !p)}
            className={`${baseSecondary} rounded-lg rounded-r-none px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700`}
          >
            <HiChevronDown
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
          {dropdownOpen && (
            <div className="absolute top-full mt-1 left-0 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
              {secondaryActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        color="blue"
        type="button"
        onClick={primary.onClick}
        className={`flex items-center h-full gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer ${
          secondaryActions.length > 0 ? "rounded-lg rounded-l-none" : "rounded-lg"
        } `}
      >
        {primary.icon}
        {primary.label}
      </Button>
    </div>
  );
}
