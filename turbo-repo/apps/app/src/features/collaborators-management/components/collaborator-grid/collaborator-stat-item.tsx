"use client";

import type { IconType } from "react-icons";

interface CollaboratorStatItemProps {
  readonly icon: IconType;
  readonly label: string;
  readonly value: string;
}

export default function CollaboratorStatItem({
  icon: Icon,
  label,
  value,
}: CollaboratorStatItemProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {value}
      </span>
    </div>
  );
}
