/**
 * Lead time data for a service - tracks compliance of OC lines.
 *
 * `lineasoc_pctn_cumplimiento` is `null` when the upstream service has no
 * compliance metric calculated yet (e.g. brand-new service, no scheduled
 * deliveries). This is distinct from `0`, which means measured-and-failing.
 * The backend's calendarPlanningPriority preset treats null as "lowest
 * priority" via `COALESCE(rate, 1.0)`, so the FE must render it as a
 * neutral "no data" state — never as 0%.
 */
export interface LeadTimeData {
  total_lineasoc_cumplen: number;
  total_lineasoc_incumplen: number;
  lineasoc_pctn_cumplimiento: number | null; // 0-100 or null when unmeasured
}

/**
 * Get lead time status based on compliance percentage.
 *  null → unknown (no data yet)
 *  100% → success
 *  >0% and <100% → warning
 *  0% → error
 */
export function getLeadTimeStatus(
  leadTime: LeadTimeData
): "success" | "warning" | "error" | "unknown" {
  const pct = leadTime.lineasoc_pctn_cumplimiento;
  if (pct == null) return "unknown";
  if (pct >= 100) return "success";
  if (pct > 0) return "warning";
  return "error";
}
