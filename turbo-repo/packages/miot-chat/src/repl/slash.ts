// Legacy slash parser. The TUI uses src/tui/slash/ instead — registry +
// parser + per-command handlers. This module is kept for the headless
// REPL in src/repl/loop.ts and is retired alongside it.
import { DEFAULT_MODEL_ARG } from "../models.js";

export type SlashAction =
  | { kind: "noop" }
  | { kind: "exit" }
  | { kind: "reset" }
  | { kind: "list-models" }
  | { kind: "set-model"; model: string | null }
  | { kind: "set-tenant"; tenant: string }
  | { kind: "save"; path: string }
  | { kind: "invalid"; reason: string };

export function parseSlash(line: string): SlashAction {
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

    case "model": {
      const value = rest[0];
      if (value === undefined || value.length === 0) {
        return { kind: "list-models" };
      }
      return {
        kind: "set-model",
        model: value === DEFAULT_MODEL_ARG ? null : value,
      };
    }

    case "tenant": {
      const value = rest[0];
      if (value === undefined || value.length === 0) {
        return { kind: "invalid", reason: "usage: /tenant <id>" };
      }
      return { kind: "set-tenant", tenant: value };
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
