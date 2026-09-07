/**
 * The same preset palette the dashboard colour pickers use (Tailwind's
 * `emerald / blue / violet / rose / amber / cyan / lime / orange` at the 500
 * shade — see `TIME_WINDOW_COLORS` in `@microboxlabs/miot-calendar-ui`). Kept
 * as a local map because the orbs need the raw hex for the WebGL material and
 * the flight animation, not just a Tailwind class.
 */
export type WorkerColor =
  | "emerald"
  | "blue"
  | "violet"
  | "rose"
  | "amber"
  | "cyan"
  | "lime"
  | "orange";

export const WORKER_COLORS: Record<WorkerColor, { hex: string; dotClass: string }> = {
  emerald: { hex: "#10b981", dotClass: "bg-emerald-500" },
  blue: { hex: "#3b82f6", dotClass: "bg-blue-500" },
  violet: { hex: "#8b5cf6", dotClass: "bg-violet-500" },
  rose: { hex: "#f43f5e", dotClass: "bg-rose-500" },
  amber: { hex: "#f59e0b", dotClass: "bg-amber-500" },
  cyan: { hex: "#06b6d4", dotClass: "bg-cyan-500" },
  lime: { hex: "#84cc16", dotClass: "bg-lime-500" },
  orange: { hex: "#f97316", dotClass: "bg-orange-500" },
};

export const workerHex = (c: WorkerColor): string => WORKER_COLORS[c].hex;
