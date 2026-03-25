"use client";

import {
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
} from "react-icons/hi2";

export type StatusIndicatorStatus = "good" | "warning" | "critical";

interface StatusIndicatorProps {
  readonly status: StatusIndicatorStatus;
  readonly label: string;
}

const colors: Record<StatusIndicatorStatus, string> = {
  good: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  critical: "text-red-600 dark:text-red-400",
};

const icons = {
  good: HiOutlineCheckCircle,
  warning: HiOutlineExclamationTriangle,
  critical: HiOutlineXCircle,
};

export default function StatusIndicator({
  status,
  label,
}: StatusIndicatorProps) {
  const Icon = icons[status];

  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${colors[status]}`} />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </div>
  );
}
