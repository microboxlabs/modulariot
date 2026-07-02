import type {
  MiotHarnessClient,
  SkillSummary,
} from "@microboxlabs/miot-harness-client";
import type {
  SlashCommand,
  SlashContext,
  SlashResult,
} from "../registry.js";
import type { SessionState, TranscriptItem } from "../../session/types.js";

interface SkillsCtx extends SlashContext {
  client: MiotHarnessClient;
  session: SessionState;
  now: () => string;
  uuid: () => string;
}

function isSkillsCtx(ctx: SlashContext): ctx is SkillsCtx {
  // Verify the bits the handler actually uses — that `skills.list` is
  // callable and a tenant id is present — not just that the keys exist, so
  // a partial/older client or context yields the clean "not bound" error
  // instead of a thrown TypeError.
  const client = ctx.client as { skills?: { list?: unknown } } | undefined;
  const session = ctx.session as { meta?: { tenantId?: unknown } } | undefined;
  return (
    typeof client?.skills?.list === "function" &&
    typeof session?.meta?.tenantId === "string" &&
    typeof ctx.now === "function" &&
    typeof ctx.uuid === "function"
  );
}

function formatSkills(skills: SkillSummary[]): string {
  if (skills.length === 0) return "no skills available";
  const lines = skills.map((s) => {
    const trigger = (s.when_to_use || s.description || "")
      .replace(/\s+/g, " ")
      .trim();
    const short = trigger.length > 80 ? `${trigger.slice(0, 79)}…` : trigger;
    return short ? `  • ${s.name} — ${short}` : `  • ${s.name}`;
  });
  return [`available skills (${skills.length}):`, ...lines].join("\n");
}

export const skillsCommand: SlashCommand = {
  name: "skills",
  summary: "List skills the harness can use",
  usage: "/skills",
  handle: async (_args, ctx): Promise<SlashResult> => {
    if (!isSkillsCtx(ctx)) {
      return { error: "skills: client/session not bound on SlashContext" };
    }
    try {
      const skills = await ctx.client.skills.list({
        tenant: ctx.session.meta.tenantId,
      });
      const item: TranscriptItem = {
        kind: "system",
        id: ctx.uuid(),
        text: formatSkills(skills),
        ts: ctx.now(),
      };
      return { output: item };
    } catch (err) {
      return {
        error: `skills: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
