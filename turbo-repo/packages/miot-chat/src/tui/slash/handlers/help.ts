import type {
  SlashCommand,
  SlashContext,
  SlashRegistry,
  SlashResult,
} from "../registry.js";
import type { TranscriptItem } from "../../session/types.js";

interface HelpCtx extends SlashContext {
  registry: SlashRegistry;
  now: () => string;
  uuid: () => string;
}

function isHelpCtx(ctx: SlashContext): ctx is HelpCtx {
  return (
    typeof ctx.registry === "object" &&
    ctx.registry !== null &&
    "all" in (ctx.registry as object) &&
    typeof ctx.now === "function" &&
    typeof ctx.uuid === "function"
  );
}

export const helpCommand: SlashCommand = {
  name: "help",
  summary: "List slash commands",
  usage: "/help",
  handle: (_args, ctx): SlashResult => {
    if (!isHelpCtx(ctx)) {
      return { error: "help: registry/now/uuid not bound on SlashContext" };
    }
    const lines = ctx.registry
      .all()
      .map((c) => `  ${c.usage.padEnd(22)} ${c.summary}`);
    const item: TranscriptItem = {
      kind: "system",
      id: ctx.uuid(),
      text: ["available commands:", ...lines].join("\n"),
      ts: ctx.now(),
    };
    return { output: item };
  },
};
