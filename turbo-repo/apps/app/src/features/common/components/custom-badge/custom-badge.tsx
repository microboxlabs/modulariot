"use client";

import { twMerge } from "tailwind-merge";

interface CustomBadgeProps {
  readonly text: string;
  readonly className?: string;
}

export default function CustomBadge({ text, className }: CustomBadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        className
      )}
    >
      {text}
    </span>
  );
}
