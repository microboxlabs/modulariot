import type { SlashCommand, SlashContext, SlashResult } from "../registry.js";
import type { TranscriptItem } from "../../session/types.js";
import type { EpisodeRecorder } from "../../../episodes.js";

interface RememberCtx extends SlashContext {
  recordEpisode: EpisodeRecorder;
  now: () => string;
  uuid: () => string;
}

function isRememberCtx(ctx: SlashContext): ctx is RememberCtx {
  return (
    typeof (ctx as RememberCtx).recordEpisode === "function" &&
    typeof (ctx as RememberCtx).now === "function" &&
    typeof (ctx as RememberCtx).uuid === "function"
  );
}

/**
 * Teach the assistant a business fact from the chat (the coding-harness
 * `/remember` pattern). Captured as a `cli` interaction episode scoped to this
 * user; a later phase reviews it before it becomes a shared definition — a
 * user's teach never poisons the tenant ontology directly.
 */
export const rememberCommand: SlashCommand = {
  name: "remember",
  summary: "Teach a business fact for the semantic layer (proposed for review, not shared yet)",
  usage: "/remember <fact>",
  argSchema: [{ name: "fact", required: true }],
  handle: (args, ctx): SlashResult => {
    const fact = args.join(" ").trim();
    if (fact.length === 0) {
      return { error: "usage: /remember <fact>" };
    }
    if (!isRememberCtx(ctx)) {
      return {
        error: "remember: episode recorder not available (no org-scoped base URL?)",
      };
    }
    ctx.recordEpisode({ surface: "cli", signal: "remember", payload: { fact } });
    const item: TranscriptItem = {
      kind: "system",
      id: ctx.uuid(),
      text: `Noted "${fact}" — I'll propose it for review before it becomes a shared definition.`,
      ts: ctx.now(),
    };
    return { output: item };
  },
};
