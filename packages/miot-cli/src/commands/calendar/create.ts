import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printDetail, printSuccess } from "../../output.js";
import { handleError } from "../../utils/error.js";

export function registerCreateCommand(parent: Command): void {
  parent
    .command("create")
    .description("Create a new calendar")
    .requiredOption("--code <code>", "Calendar code")
    .requiredOption("--name <name>", "Calendar name")
    .option("--timezone <tz>", "Timezone")
    .option("--description <desc>", "Description")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          code: string;
          name: string;
          timezone?: string;
          description?: string;
        };

        const calendar = await client.calendars.create({
          code: opts.code,
          name: opts.name,
          timezone: opts.timezone,
          description: opts.description,
        });

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

export function registerUpdateCommand(parent: Command): void {
  parent
    .command("update <id>")
    .description("Update a calendar")
    .option("--code <code>", "Calendar code")
    .option("--name <name>", "Calendar name")
    .option("--timezone <tz>", "Timezone")
    .option("--description <desc>", "Description")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          code?: string;
          name?: string;
          timezone?: string;
          description?: string;
        };

        const calendar = await client.calendars.update(id, {
          code: opts.code!,
          name: opts.name!,
          timezone: opts.timezone,
          description: opts.description,
        });

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

export function registerDeactivateCommand(parent: Command): void {
  parent
    .command("deactivate <id>")
    .description("Deactivate a calendar")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        await client.calendars.deactivate(id);

        if (outputMode === "json") {
          printJson({ success: true });
        } else {
          printSuccess(`Calendar ${id} deactivated.`);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
