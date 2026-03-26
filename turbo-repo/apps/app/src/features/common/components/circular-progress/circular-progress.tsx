"use client";

interface CircularProgressProps {
  readonly value: number;
  readonly size?: number;
}

export default function CircularProgress({
  value,
  size = 40,
}: CircularProgressProps) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getColorClass = (val: number): string => {
    if (val >= 80) return "text-green-500";
    if (val >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const color = getColorClass(value);

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
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {value}
        </span>
      </div>
    </div>
  );
}
