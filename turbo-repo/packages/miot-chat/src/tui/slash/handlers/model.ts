import type {
  MiotHarnessClient,
  ModelsInfo,
} from "@microboxlabs/miot-harness-client";
import { DEFAULT_MODEL_ARG, checkModel, formatModels } from "../../../models.js";
import type {
  SlashCommand,
  SlashContext,
  SlashResult,
} from "../registry.js";
import type { SessionState } from "../../session/types.js";

function listModels(ctx: SlashContext): Promise<ModelsInfo> | null {
  const client = ctx.client as Partial<MiotHarnessClient> | undefined;
  const models = client?.models;
  return typeof models?.list === "function" ? models.list() : null;
}

function currentModel(ctx: SlashContext): string | null {
  const session = ctx.session as Partial<SessionState> | undefined;
  return session?.meta?.model ?? null;
}

function withOutput(
  result: SlashResult,
  ctx: SlashContext,
  text: string,
): SlashResult {
  if (typeof ctx.now !== "function" || typeof ctx.uuid !== "function") {
    return result;
  }
  const now = ctx.now as () => string;
  const uuid = ctx.uuid as () => string;
  return { ...result, output: { kind: "system", id: uuid(), text, ts: now() } };
}

export const modelCommand: SlashCommand = {
  name: "model",
  summary: "List conversation models, or pick one for this session",
  usage: `/model [<name>|${DEFAULT_MODEL_ARG}]`,
  argSchema: [{ name: "model", required: false }],
  handle: async (args, ctx): Promise<SlashResult> => {
    const value = args[0];

    if (value === undefined || value.length === 0) {
      const pending = listModels(ctx);
      if (!pending) return { error: "model: client not bound on SlashContext" };
      try {
        const info = await pending;
        return withOutput({}, ctx, formatModels(info, currentModel(ctx)));
      } catch (err) {
        return {
          error: `model: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    if (value === DEFAULT_MODEL_ARG) {
      return withOutput(
        { dispatch: { kind: "SET_MODEL", model: null } },
        ctx,
        "model: harness default",
      );
    }

    // Validate against the harness list when it can be fetched; if the
    // list is unreachable, accept the name and let the harness reject it.
    let info: ModelsInfo | null = null;
    try {
      info = (await listModels(ctx)) ?? null;
    } catch {
      info = null;
    }
    const problem = info ? checkModel(info, value) : null;
    if (problem) return { error: problem };
    return withOutput(
      { dispatch: { kind: "SET_MODEL", model: value } },
      ctx,
      `model: ${value}`,
    );
  },
};
