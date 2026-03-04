import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printDetail, printSuccess } from "../../output.js";
import { handleError } from "../../utils/error.js";
import { parseOptionalInt } from "../../utils/parse.js";

export function registerCreateCommand(parent: Command): void {
  parent
    .command("create")
    .description("Create a new calendar")
    .requiredOption("--code <code>", "Calendar code")
    .requiredOption("--name <name>", "Calendar name")
    .option("--timezone <tz>", "Timezone")
    .option("--description <desc>", "Description")
    .option("--no-auto-slot-manager", "Skip auto-provisioning a default SlotManager on creation")
    .option("--group <code>", "Assign to group by code (repeatable)", (val, acc: string[]) => [...acc, val], [] as string[])
    .option("--parallelism <n>", "Parallel resources per slot (default: 1)")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          code: string;
          name: string;
          timezone?: string;
          description?: string;
          autoSlotManager: boolean;
          group: string[];
          parallelism?: string;
        };

        const calendar = await client.calendars.create({
          code: opts.code,
          name: opts.name,
          timezone: opts.timezone,
          description: opts.description,
          ...(opts.autoSlotManager === false && { autoSlotManager: false }),
          ...(opts.group.length > 0 && { groups: opts.group }),
          parallelism: parseOptionalInt(opts.parallelism, "--parallelism"),
        });

        if (outputMode === "json") {
          printJson(calendar);
        } else {
          printDetail(calendar);
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
    .option("--group <code>", "Assign to group by code (repeatable)", (val, acc: string[]) => [...acc, val], [] as string[])
    .option("--parallelism <n>", "Parallel resources per slot (default: 1)")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          code?: string;
          name?: string;
          timezone?: string;
          description?: string;
          group: string[];
          parallelism?: string;
        };

        const body = {
          ...(opts.code !== undefined && { code: opts.code }),
          ...(opts.name !== undefined && { name: opts.name }),
          ...(opts.timezone !== undefined && { timezone: opts.timezone }),
          ...(opts.description !== undefined && {
            description: opts.description,
          }),
          ...(opts.group.length > 0 && { groups: opts.group }),
          ...(opts.parallelism !== undefined && { parallelism: parseOptionalInt(opts.parallelism, "--parallelism") }),
        };

        const calendar = await client.calendars.update(id, body as Parameters<typeof client.calendars.update>[1]);

        if (outputMode === "json") {
          printJson(calendar);
        } else {
          printDetail(calendar);
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

export function registerPurgeCommand(parent: Command): void {
  parent
    .command("purge <id>")
    .description("Permanently delete a calendar and all its data (slots, bookings, time windows, slot manager)")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        await client.calendars.purge(id);

        if (outputMode === "json") {
          printJson({ success: true });
        } else {
          printSuccess(`Calendar ${id} permanently deleted.`);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
