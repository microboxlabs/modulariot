import type {
  SlashCommand,
  SlashContext,
  SlashResult,
} from "../registry.js";
import type { SessionState, TranscriptItem } from "../../session/types.js";

interface WhoamiCtx extends SlashContext {
  session: SessionState;
  now: () => string;
  uuid: () => string;
}

function isWhoamiCtx(ctx: SlashContext): ctx is WhoamiCtx {
  return (
    typeof ctx.session === "object" &&
    ctx.session !== null &&
    typeof ctx.now === "function" &&
    typeof ctx.uuid === "function"
  );
}

export const whoamiCommand: SlashCommand = {
  name: "whoami",
  summary: "Print user/tenant/conversation ids",
  usage: "/whoami",
  handle: (_args, ctx): SlashResult => {
    if (!isWhoamiCtx(ctx)) {
      return { error: "whoami: session/now/uuid not bound on SlashContext" };
    }
    const m = ctx.session.meta;
    const item: TranscriptItem = {
      kind: "system",
      id: ctx.uuid(),
      text: `user=${m.userId}  tenant=${m.tenantId}  conv=${m.conversationId}`,
      ts: ctx.now(),
    };
    return { output: item };
  },
};
