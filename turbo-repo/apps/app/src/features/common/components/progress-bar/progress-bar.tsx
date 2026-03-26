"use client";

export type ProgressBarColor = "blue" | "green" | "yellow" | "red";

interface ProgressBarProps {
  readonly value: number;
  readonly label: string;
  readonly color?: ProgressBarColor;
}

const colorClasses: Record<ProgressBarColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

export default function ProgressBar({
  value,
  label,
  color = "blue",
}: ProgressBarProps) {
  const sanitizedValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {sanitizedValue}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClasses[color]}`}
          style={{ width: `${sanitizedValue}%` }}
        />
      </div>
    </div>
  );
}
