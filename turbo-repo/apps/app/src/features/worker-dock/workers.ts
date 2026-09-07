import type { WorkerColor } from "./worker-colors";

/**
 * Demo roster for the worker dock. There is no backend "workers" concept yet —
 * this hardcoded list is the single source of truth the dock, the chat header
 * and the assistant avatar all read from. Swap it for a real data source later
 * without touching the rendering components.
 */
export type Worker = {
  id: string;
  /** Proper noun — shown verbatim, never translated. */
  name: string;
  /** Short role line, shown under the name in the dock tooltip / header. */
  role: string;
  /** One of the dashboard preset colours (see `worker-colors.ts`). */
  color: WorkerColor;
};

export const WORKERS: readonly Worker[] = [
  { id: "carlos-contabilidad", name: "Carlos contabilidad", role: "Contabilidad", color: "blue" },
  { id: "marta-rrhh", name: "Marta recursos humanos", role: "Recursos humanos", color: "rose" },
  { id: "diego-soporte", name: "Diego soporte técnico", role: "Soporte técnico", color: "emerald" },
  { id: "lucia-ventas", name: "Lucía ventas", role: "Ventas", color: "amber" },
];

export function findWorker(id: string | null | undefined): Worker | null {
  if (!id) return null;
  return WORKERS.find((w) => w.id === id) ?? null;
}
