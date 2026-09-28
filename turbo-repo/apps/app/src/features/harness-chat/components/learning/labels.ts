import type { TrFn } from "../../context/harness-chat-i18n-context";

const LAYERS = ["fact", "rule", "skill", "primer", "note", "eval"] as const;
type Layer = (typeof LAYERS)[number];

const OPS = ["upsert", "delete", "write", "edit"] as const;
type Op = (typeof OPS)[number];

export function layerLabel(layer: string, tr: TrFn): string {
  const known = LAYERS.find((l): l is Layer => l === layer);
  return known ? tr(`harnessChat.learning.layers.${known}`) : layer;
}

export function opLabel(op: string, tr: TrFn): string {
  const known = OPS.find((o): o is Op => o === op);
  return known ? tr(`harnessChat.learning.ops.${known}`) : op;
}

export function isDeleteOp(op: string | null): boolean {
  return op === "delete";
}

export const LAYER_BADGE: Record<string, string> = {
  fact: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  rule: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  skill: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  primer: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  note: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  eval: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
};

export const LAYER_DOT: Record<string, string> = {
  fact: "bg-sky-500",
  rule: "bg-violet-500",
  skill: "bg-amber-500",
  primer: "bg-teal-500",
  note: "bg-gray-400",
  eval: "bg-pink-500",
};

export const badgeClass =
  "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none";
