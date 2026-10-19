export type ChartDateRange = "all" | "7d" | "30d" | "90d" | "180d" | "1y";

const RANGE_DAYS: Partial<Record<ChartDateRange, number>> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "1y": 365,
};

/** Rolling elapsed-day cutoff. As in the existing charts, future rows are retained. */
export function filterChartRowsByDateRange<Row extends Record<string, string>>(
  rows: Row[],
  dateColumn: string,
  range: ChartDateRange,
  now = Date.now(),
): Row[] {
  if (!Object.hasOwn(RANGE_DAYS, range)) return rows;
  const days = RANGE_DAYS[range];
  if (!days) return rows;
  const cutoff = now - days * 86_400_000;
  return rows.filter((row) => {
    const value = row[dateColumn];
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}
