"use client";

import type { IconType } from "react-icons";

interface VehicleStatItemProps {
  readonly icon: IconType;
  readonly label: string;
  readonly value: string;
}

export default function VehicleStatItem({
  icon: Icon,
  label,
  value,
}: VehicleStatItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {value}
      </span>
    </div>
  );
}
