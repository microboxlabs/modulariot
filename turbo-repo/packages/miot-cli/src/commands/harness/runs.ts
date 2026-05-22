import type { Command } from "commander";
import { getHarnessActionContext } from "../../harness-context.js";
import { printDetail, printJson } from "../../output.js";
import { handleError } from "../../utils/error.js";

export function registerHarnessRunsCommand(parent: Command): void {
  const runs = parent.command("runs").description("Inspect harness runs");

  runs
    .command("get <run_id>")
    .description("Fetch a completed run (GET /runs/{id}).")
    .action(async (runId: string, _opts: unknown, cmd: Command) => {
      const { client, outputMode } = getHarnessActionContext(cmd);
      try {
        const record = await client.runs.get(runId);
        if (outputMode === "json") {
          printJson(record);
        } else {
          const { events, ...summary } = record;
          printDetail({ ...summary, events: `(${events.length} events)` });
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
