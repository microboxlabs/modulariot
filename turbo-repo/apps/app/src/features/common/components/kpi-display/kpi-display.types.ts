/**
 * Lead time data for a service - tracks compliance of OC lines
 */
export interface LeadTimeData {
  total_lineasoc_cumplen: number;
  total_lineasoc_incumplen: number;
  lineasoc_pctn_cumplimiento: number; // 0-100
}

/**
 * Get lead time status based on compliance percentage
 * 100% → success, >0% and <100% → warning, 0% → error
 */
export function getLeadTimeStatus(
  leadTime: LeadTimeData
): "success" | "warning" | "error" {
  const pct = leadTime.lineasoc_pctn_cumplimiento;
  if (pct >= 100) return "success";
  if (pct > 0) return "warning";
  return "error";
}
