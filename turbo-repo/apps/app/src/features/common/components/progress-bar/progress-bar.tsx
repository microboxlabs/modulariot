"use client";

export type ProgressBarColor = "blue" | "green" | "yellow" | "red";

interface TextWithClass {
  readonly text: string;
  readonly className?: string;
}

interface ProgressBarProps {
  readonly progress: number;
  readonly label: TextWithClass;
  readonly value?: TextWithClass;
  readonly color?: ProgressBarColor;
  readonly barClassName?: string;
  readonly description?: TextWithClass;
}

const colorClasses: Record<ProgressBarColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

export default function ProgressBar({
  progress,
  label,
  value,
  color = "blue",
  barClassName,
  description,
}: ProgressBarProps) {
  const sanitizedValue = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs items-end">
        <span className={label.className ?? "text-gray-600 dark:text-gray-400"}>
          {label.text}
        </span>
        <span className={value?.className ?? "text-xs text-gray-900 dark:text-white font-medium"}>
          {value?.text ?? `${sanitizedValue}%`}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barClassName ?? colorClasses[color]}`}
          style={{ width: `${sanitizedValue}%` }}
        />
      </div>
      {description && (
        <span className={description.className ?? "text-xs text-gray-500 dark:text-gray-400"}>
          {description.text}
        </span>
      )}
    </div>
  );
}
