import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printTable } from "../../output.js";
import { handleError } from "../../utils/error.js";

export function registerListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List calendars")
    .option("--group <code>", "Filter by group code")
    .option("--active", "Show only active calendars")
    .option("--inactive", "Show only inactive calendars")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          group?: string;
          active?: boolean;
          inactive?: boolean;
        };

        const active = opts.active ? true : opts.inactive ? false : undefined;

        const calendars = await client.calendars.list({
          active,
          groupCode: opts.group,
        });

        if (outputMode === "json") {
          printJson(calendars);
        } else {
          printTable(calendars as unknown as Record<string, unknown>[], [
            { header: "ID", key: "id" },
            { header: "CODE", key: "code" },
            { header: "NAME", key: "name" },
            { header: "TIMEZONE", key: "timezone" },
            { header: "ACTIVE", key: "active" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
