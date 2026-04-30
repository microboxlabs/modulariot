/**
 * Format an occupancy percentage (0-100) for display, fixed to 2 decimals.
 * Use in any UI that surfaces `SelectedService.ocupacion` so the format stays consistent.
 */
export function formatOccupancyPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)}%`;
}
