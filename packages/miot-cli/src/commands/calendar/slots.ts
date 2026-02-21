import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printTable, printDetail } from "../../output.js";
import { handleError } from "../../utils/error.js";

export function registerSlotsCommand(parent: Command): void {
  const slots = parent
    .command("slots")
    .description("Manage calendar slots");

  slots
    .command("list")
    .description("List slots for a calendar")
    .requiredOption("--calendar <id>", "Calendar ID")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--available", "Show only available slots")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          calendar: string;
          from?: string;
          to?: string;
          available?: boolean;
        };

        const result = await client.slots.list({
          calendarId: opts.calendar,
          startDate: opts.from,
          endDate: opts.to,
          available: opts.available,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result.data as unknown as Record<string, unknown>[], [
            { header: "ID", key: "id" },
            { header: "DATE", key: "slotDate" },
            { header: "HOUR", key: "slotHour" },
            { header: "MIN", key: "slotMinutes" },
            { header: "CAPACITY", key: "capacity" },
            { header: "OCCUPIED", key: "currentOccupancy" },
            { header: "AVAILABLE", key: "availableCapacity" },
            { header: "STATUS", key: "status" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  slots
    .command("get <id>")
    .description("Get a slot by ID")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const slot = await client.slots.get(id);

        if (outputMode === "json") {
          printJson(slot);
        } else {
          printDetail(slot as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  slots
    .command("generate")
    .description("Generate slots for a calendar")
    .requiredOption("--calendar <id>", "Calendar ID")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          calendar: string;
          from: string;
          to: string;
        };

        const result = await client.slots.generate({
          calendarId: opts.calendar,
          startDate: opts.from,
          endDate: opts.to,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  slots
    .command("update-status <id>")
    .description("Update slot status")
    .requiredOption("--status <status>", "New status (OPEN or CLOSED)")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as { status: string };

        const slot = await client.slots.updateStatus(id, {
          status: opts.status as "OPEN" | "CLOSED",
        });

        if (outputMode === "json") {
          printJson(slot);
        } else {
          printDetail(slot as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
