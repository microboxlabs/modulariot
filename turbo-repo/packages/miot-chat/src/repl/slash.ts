import type { RunMode } from "../harness/types.js";

export const AGENTIC_TENANT_LOCK = "mintral";

export interface SlashState {
  mode: RunMode;
  tenant: string;
}

export type SlashAction =
  | { kind: "noop" }
  | { kind: "exit" }
  | { kind: "reset" }
  | { kind: "set-mode"; mode: RunMode; warnAgenticTenantMismatch: boolean }
  | { kind: "set-tenant"; tenant: string; warnAgenticTenantMismatch: boolean }
  | { kind: "save"; path: string }
  | { kind: "invalid"; reason: string };

const VALID_MODES: ReadonlySet<RunMode> = new Set<RunMode>([
  "auto",
  "canned",
  "meta",
  "agentic",
]);

export function parseSlash(line: string, state: SlashState): SlashAction {
  const trimmed = line.trim();
  if (!trimmed.startsWith("/")) return { kind: "noop" };

  const parts = trimmed.slice(1).split(/\s+/);
  const head = parts[0]?.toLowerCase() ?? "";
  const rest = parts.slice(1);

  switch (head) {
    case "":
      return { kind: "invalid", reason: "empty slash command" };

    case "exit":
    case "quit":
      return { kind: "exit" };

    case "reset":
      return { kind: "reset" };

    case "mode": {
      const value = rest[0];
      if (value === undefined) {
        return {
          kind: "invalid",
          reason: "usage: /mode <auto|canned|meta|agentic>",
        };
      }
      if (!VALID_MODES.has(value as RunMode)) {
        return { kind: "invalid", reason: `unknown mode: ${value}` };
      }
      const newMode = value as RunMode;
      return {
        kind: "set-mode",
        mode: newMode,
        warnAgenticTenantMismatch:
          newMode === "agentic" && state.tenant !== AGENTIC_TENANT_LOCK,
      };
    }

    case "tenant": {
      const value = rest[0];
      if (value === undefined || value.length === 0) {
        return { kind: "invalid", reason: "usage: /tenant <id>" };
      }
      return {
        kind: "set-tenant",
        tenant: value,
        warnAgenticTenantMismatch:
          state.mode === "agentic" && value !== AGENTIC_TENANT_LOCK,
      };
    }

    case "save": {
      const path = rest.join(" ");
      if (path.length === 0) {
        return { kind: "invalid", reason: "usage: /save <file>" };
      }
      return { kind: "save", path };
    }

    default:
      return { kind: "invalid", reason: `unknown command: /${head}` };
  }
}
