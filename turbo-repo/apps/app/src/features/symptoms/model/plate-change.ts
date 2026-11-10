/**
 * The plate the case's trip runs on now, when it is not the case's: the truck
 * was replaced after the case opened. Null otherwise.
 */
export function tripPlateNow(
  casePlate: string | null | undefined,
  tripPlate: string | null | undefined
): string | null {
  const now = tripPlate?.trim();
  if (!now || !casePlate?.trim()) return null;
  return now.toUpperCase() === casePlate.trim().toUpperCase() ? null : now;
}
