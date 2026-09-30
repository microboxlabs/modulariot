/** Aggregate the authorized result by service before computing totals and shares. */
export function aggregateServices(input) {
  const totals = new Map();
  if (!Array.isArray(input)) return [];
  for (const row of input) {
    if (!row || typeof row.service !== "string") continue;
    const cost = row.net_cost;
    if (
      (typeof cost !== "number" && typeof cost !== "string") ||
      cost === "" ||
      !Number.isFinite(Number(cost))
    )
      continue;
    totals.set(row.service, (totals.get(row.service) ?? 0) + Number(cost));
  }
  return [...totals]
    .map(([service, net_cost]) => ({ service, net_cost }))
    .sort((a, b) => b.net_cost - a.net_cost);
}
