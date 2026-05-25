import type { SlashArgSpec } from "./registry.js";

export interface ParsedSlash {
  name: string;
  args: string[];
}

export function parseSlash(line: string): ParsedSlash | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("/")) return null;
  const body = trimmed.slice(1);
  if (body.length === 0) return null;
  const tokens = body.split(/\s+/);
  const head = (tokens[0] ?? "").toLowerCase();
  if (head.length === 0) return null;
  return { name: head, args: tokens.slice(1) };
}

export interface ValidationOk {
  ok: true;
  values: Record<string, string | undefined>;
}

export interface ValidationErr {
  ok: false;
  error: string;
}

export type ValidationResult = ValidationOk | ValidationErr;

export function validateArgs(
  spec: readonly SlashArgSpec[] | undefined,
  args: string[],
): ValidationResult {
  if (!spec || spec.length === 0) return { ok: true, values: {} };
  const values: Record<string, string | undefined> = {};
  for (let i = 0; i < spec.length; i += 1) {
    const s = spec[i];
    if (!s) continue;
    const val = args[i];
    if (val === undefined || val.length === 0) {
      if (s.required) {
        return { ok: false, error: `missing argument: ${s.name}` };
      }
      values[s.name] = undefined;
      continue;
    }
    if (s.choices && !s.choices.includes(val)) {
      return { ok: false, error: `unknown ${s.name}: ${val}` };
    }
    values[s.name] = val;
  }
  return { ok: true, values };
}
