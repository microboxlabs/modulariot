"use client";

import { twMerge } from "tailwind-merge";
import { HiXMark } from "react-icons/hi2";

interface CustomBadgeProps {
  readonly text: string;
  readonly className?: string;
  readonly onRemove?: () => void;
}

export default function CustomBadge({ text, className, onRemove }: CustomBadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        className
      )}
    >
      {text}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <HiXMark className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
