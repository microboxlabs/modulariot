/**
 * Format a 0-100 percentage value for display, fixed to 2 decimals.
 * Use for occupancy and load utilization fields so the format stays consistent.
 */
export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)}%`;
}
