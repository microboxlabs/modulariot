"use client";

import { type RefObject, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

const dropdownClassName = twMerge(
  "absolute z-50 min-w-full mt-1",
  "bg-white dark:bg-gray-800",
  "border border-gray-200 dark:border-gray-700",
  "rounded-lg shadow-lg",
  "max-h-48 overflow-y-auto",
  "py-1"
);

interface DropdownListProps<T> {
  items: T[];
  selectedIndex: number;
  onSelect: (item: T) => void;
  onHover: (index: number) => void;
  dropdownRef: RefObject<HTMLUListElement | null>;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  itemClassName?: string;
}

export function DropdownList<T>({
  items,
  selectedIndex,
  onSelect,
  onHover,
  dropdownRef,
  getKey,
  renderItem,
  itemClassName,
}: Readonly<DropdownListProps<T>>) {
  return (
    <ul ref={dropdownRef} className={dropdownClassName}>
      {items.map((item, index) => (
        <li key={getKey(item)}>
          <button
            type="button"
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(index)}
            className={twMerge(
              "w-full text-left px-3 py-1.5 text-sm cursor-pointer whitespace-nowrap",
              "transition-colors border-0 bg-transparent",
              index === selectedIndex
                ? "bg-blue-50 dark:bg-blue-900/30"
                : "hover:bg-gray-50 dark:hover:bg-gray-700",
              "text-gray-900 dark:text-white",
              itemClassName
            )}
          >
            {renderItem(item)}
          </button>
        </li>
      ))}
    </ul>
  );
}
