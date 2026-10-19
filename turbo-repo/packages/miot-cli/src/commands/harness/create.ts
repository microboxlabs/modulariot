import type { Command } from "commander";
import type { UserRequest } from "@microboxlabs/miot-harness-client";
import { getHarnessActionContext } from "../../harness-context.js";
import { printDetail, printJson } from "../../output.js";
import { handleError } from "../../utils/error.js";

interface CreateOpts {
  tenant?: string;
  user?: string;
  model?: string;
  conversation?: string;
  thread?: string;
  skill?: string;
}

export function registerHarnessCreateCommand(parent: Command): void {
  parent
    .command("create <message>")
    .description(
      "Dispatch a harness run asynchronously (POST /runs:start) and print { run_id }.",
    )
    .option("--tenant <id>", "Tenant ID")
    .option("--user <id>", "User ID")
    .option(
      "--model <name>",
      "Conversation model (see `GET /models`; omit for the harness default)",
    )
    .option(
      "--conversation <id>",
      "Conversation ID for multi-turn context (defaults to a fresh UUID server-side)",
    )
    .option("--thread <id>", "Thread ID (defaults to the harness's demo-thread)")
    .option(
      "--skill <id>",
      "Activate a skill for this run (injects its SKILL.md body as guidance)",
    )
    .action(async (message: string, opts: CreateOpts, cmd: Command) => {
      const { client, outputMode } = getHarnessActionContext(cmd);
      try {
        const req: UserRequest = {
          message,
          ...(opts.tenant !== undefined && { tenant_id: opts.tenant }),
          ...(opts.user !== undefined && { user_id: opts.user }),
          ...(opts.model !== undefined &&
            opts.model !== "" && { model: opts.model }),
          ...(opts.conversation !== undefined && {
            conversation_id: opts.conversation,
          }),
          ...(opts.thread !== undefined && { thread_id: opts.thread }),
          ...(opts.skill !== undefined && { skill_id: opts.skill }),
        };
        const result = await client.runs.create(req);
        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
