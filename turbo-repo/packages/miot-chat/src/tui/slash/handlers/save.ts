import { writeFileSync } from "node:fs";
import type {
  SlashCommand,
  SlashContext,
  SlashResult,
} from "../registry.js";
import type { SessionState, TranscriptItem } from "../../session/types.js";

interface SaveCtx extends SlashContext {
  session: SessionState;
  now: () => string;
  uuid: () => string;
  writeFile?: (path: string, body: string) => void;
}

function isSaveCtx(ctx: SlashContext): ctx is SaveCtx {
  return (
    typeof ctx.session === "object" &&
    ctx.session !== null &&
    typeof ctx.now === "function" &&
    typeof ctx.uuid === "function"
  );
}

export const saveCommand: SlashCommand = {
  name: "save",
  summary: "Write the current transcript to a JSON file",
  usage: "/save <path>",
  argSchema: [{ name: "path", required: true }],
  handle: (args, ctx): SlashResult => {
    const path = args.join(" ").trim();
    if (path.length === 0) {
      return { error: "usage: /save <path>" };
    }
    if (!isSaveCtx(ctx)) {
      return { error: "save: session/now/uuid not bound on SlashContext" };
    }
    const body = JSON.stringify(
      {
        conversation_id: ctx.session.meta.conversationId,
        transcript: ctx.session.transcript,
      },
      null,
      2,
    );
    const write = ctx.writeFile ?? defaultWrite;
    try {
      write(path, body);
    } catch (err) {
      return {
        error: `save failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const item: TranscriptItem = {
      kind: "system",
      id: ctx.uuid(),
      text: `saved transcript to ${path}`,
      ts: ctx.now(),
    };
    return { output: item };
  },
};

function defaultWrite(path: string, body: string): void {
  writeFileSync(path, body);
}
