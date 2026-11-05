import { quotaLevel, quotaPercent, type QuotaLevel } from "./usage-view";

const BAR_COLORS: Record<QuotaLevel, string> = {
  ok: "bg-blue-500",
  alert: "bg-amber-500",
  exhausted: "bg-red-500",
};

const HEIGHT = { sm: "h-1.5", md: "h-2" } as const;

/** Usage against a quota: blue, amber from the alert share, red when used up. */
export default function QuotaBar({
  used,
  quota,
  alertPct,
  size = "md",
  className = "",
}: Readonly<{
  used: number;
  quota: number;
  alertPct: number;
  size?: keyof typeof HEIGHT;
  className?: string;
}>) {
  const level = quotaLevel(used, quota, alertPct);
  return (
    <div
      className={`${className} ${HEIGHT[size]} w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700`}
    >
      <div
        data-level={level}
        className={`h-full rounded-full ${BAR_COLORS[level]}`}
        style={{ width: `${quotaPercent(used, quota)}%` }}
      />
    </div>
  );
}
