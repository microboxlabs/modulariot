import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printDetail } from "../../output.js";
import { handleError } from "../../utils/error.js";

export function registerGetCommand(parent: Command): void {
  parent
    .command("get <id>")
    .description("Get a calendar by ID")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const calendar = await client.calendars.get(id);

        if (outputMode === "json") {
          printJson(calendar);
        } else {
          printDetail(calendar as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
