"use client";

import { twMerge } from "tailwind-merge";

interface ConnectionStatusBadgeProps {
  readonly isConnected: boolean;
  readonly signalStrength: number; // 0-100 percentage
  readonly connectedLabel?: string;
  readonly disconnectedLabel?: string;
  readonly className?: string;
}

function getSignalLevel(percentage: number): 0 | 1 | 2 | 3 | 4 {
  if (percentage <= 0) return 0;
  if (percentage <= 25) return 1;
  if (percentage <= 50) return 2;
  if (percentage <= 75) return 3;
  return 4;
}

function getSignalColor(level: number, isConnected: boolean): string {
  if (!isConnected || level === 0) return "text-gray-400 dark:text-gray-500";
  if (level === 1) return "text-red-500 dark:text-red-400";
  if (level === 2) return "text-yellow-500 dark:text-yellow-400";
  return "text-green-500 dark:text-green-400";
}

interface SignalIconProps {
  readonly level: 0 | 1 | 2 | 3 | 4;
  readonly isConnected: boolean;
}

function SignalIcon({ level, isConnected }: SignalIconProps) {
  const activeColor = isConnected
    ? getSignalColor(level, isConnected)
    : "text-gray-400 dark:text-gray-500";
  const inactiveColor = "text-gray-300 dark:text-gray-600";

  return (
    <svg
      className={twMerge("w-4 h-4", activeColor)}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      {/* Bar 1 - always visible when connected */}
      <rect
        x="2"
        y="16"
        width="4"
        height="6"
        rx="1"
        className={level >= 1 && isConnected ? activeColor : inactiveColor}
      />
      {/* Bar 2 */}
      <rect
        x="8"
        y="12"
        width="4"
        height="10"
        rx="1"
        className={level >= 2 && isConnected ? activeColor : inactiveColor}
      />
      {/* Bar 3 */}
      <rect
        x="14"
        y="7"
        width="4"
        height="15"
        rx="1"
        className={level >= 3 && isConnected ? activeColor : inactiveColor}
      />
      {/* Bar 4 */}
      <rect
        x="20"
        y="2"
        width="4"
        height="20"
        rx="1"
        className={level >= 4 && isConnected ? activeColor : inactiveColor}
      />
    </svg>
  );
}

export default function ConnectionStatusBadge({
  isConnected,
  signalStrength,
  connectedLabel = "Conectado",
  disconnectedLabel = "Desconectado",
  className,
}: ConnectionStatusBadgeProps) {
  const signalLevel = getSignalLevel(signalStrength);

  const badgeClasses = twMerge(
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
    isConnected
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    className
  );

  return (
    <span className={badgeClasses}>
      <SignalIcon level={signalLevel} isConnected={isConnected} />
      {isConnected ? connectedLabel : disconnectedLabel}
    </span>
  );
}
