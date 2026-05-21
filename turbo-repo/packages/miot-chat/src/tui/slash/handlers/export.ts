import { writeFileSync } from "node:fs";
import type {
  SlashCommand,
  SlashContext,
  SlashResult,
} from "../registry.js";
import type { SessionState, TranscriptItem } from "../../session/types.js";
import { toMarkdown } from "../../persistence/exportMarkdown.js";

interface ExportCtx extends SlashContext {
  session: SessionState;
  now: () => string;
  uuid: () => string;
  writeFile?: (path: string, body: string) => void;
}

function isExportCtx(ctx: SlashContext): ctx is ExportCtx {
  return (
    typeof ctx.session === "object" &&
    ctx.session !== null &&
    typeof ctx.now === "function" &&
    typeof ctx.uuid === "function"
  );
}

export const exportCommand: SlashCommand = {
  name: "export",
  summary: "Write the transcript as markdown to a file",
  usage: "/export <path>",
  argSchema: [{ name: "path", required: true }],
  handle: (args, ctx): SlashResult => {
    const path = args.join(" ").trim();
    if (path.length === 0) {
      return { error: "usage: /export <path>" };
    }
    if (!isExportCtx(ctx)) {
      return { error: "export: session/now/uuid not bound on SlashContext" };
    }
    const body = toMarkdown(ctx.session);
    const write = ctx.writeFile ?? defaultWrite;
    try {
      write(path, body);
    } catch (err) {
      return {
        error: `export failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const item: TranscriptItem = {
      kind: "system",
      id: ctx.uuid(),
      text: `exported transcript to ${path}`,
      ts: ctx.now(),
    };
    return { output: item };
  },
};

function defaultWrite(path: string, body: string): void {
  writeFileSync(path, body);
}
