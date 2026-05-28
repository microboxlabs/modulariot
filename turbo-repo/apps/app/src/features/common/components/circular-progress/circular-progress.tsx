"use client";

interface CircularProgressProps {
  readonly value: number;
  readonly size?: number;
  /** Upper bound for the progress fill and color thresholds. Defaults to 100. */
  readonly max?: number;
}

export default function CircularProgress({
  value,
  size = 40,
  max = 100,
}: CircularProgressProps) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, value / max));
  const offset = circumference - ratio * circumference;

  const getColorClass = (pct: number): string => {
    if (pct >= 0.8) return "text-green-500";
    if (pct >= 0.6) return "text-yellow-500";
    return "text-red-500";
  };

  const color = getColorClass(ratio);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-light text-gray-700 dark:text-gray-300"
          style={{ fontSize: Math.max(6, Math.round(size * 0.3)) }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
