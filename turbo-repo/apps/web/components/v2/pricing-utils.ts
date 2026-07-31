export const clampAssets = (n: number) =>
  Math.max(1, Math.min(100000, Math.round(n) || 0));
