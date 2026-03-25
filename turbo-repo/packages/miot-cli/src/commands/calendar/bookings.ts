import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printTable, printDetail, printSuccess } from "../../output.js";
import { handleError } from "../../utils/error.js";
import { parseIntOrThrow } from "../../utils/parse.js";

export function registerBookingsCommand(parent: Command): void {
  const bookings = parent
    .command("bookings")
    .description("Manage calendar bookings");

  bookings
    .command("list")
    .description("List bookings")
    .option("--calendar <id>", "Calendar ID")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          calendar?: string;
          from?: string;
          to?: string;
        };

        const result = await client.bookings.list({
          calendarId: opts.calendar,
          startDate: opts.from,
          endDate: opts.to,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result.data, [
            { header: "ID", key: "id" },
            { header: "CALENDAR", key: "calendarId" },
            { header: "RESOURCE", key: "resource.id" },
            { header: "DATE", key: "slot.date" },
            { header: "HOUR", key: "slot.hour" },
            { header: "MIN", key: "slot.minutes" },
            { header: "CREATED", key: "createdAt" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  bookings
    .command("get <id>")
    .description("Get a booking by ID")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const booking = await client.bookings.get(id);

        if (outputMode === "json") {
          printJson(booking);
        } else {
          printDetail(booking);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  bookings
    .command("create")
    .description("Create a booking")
    .requiredOption("--calendar <id>", "Calendar ID")
    .requiredOption("--resource-id <id>", "Resource ID")
    .option("--resource-type <type>", "Resource type")
    .option("--resource-label <label>", "Resource label")
    .requiredOption("--date <date>", "Slot date (YYYY-MM-DD)")
    .requiredOption("--hour <hour>", "Slot hour (0-23)")
    .requiredOption("--minutes <minutes>", "Slot minutes (0-59)")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          calendar: string;
          resourceId: string;
          resourceType?: string;
          resourceLabel?: string;
          date: string;
          hour: string;
          minutes: string;
        };

        const hour = parseIntOrThrow(opts.hour, "--hour");
        const minutes = parseIntOrThrow(opts.minutes, "--minutes");

        if (hour < 0 || hour > 23) {
          throw new Error(`Invalid --hour: ${hour}. Must be 0-23.`);
        }
        if (minutes < 0 || minutes > 59) {
          throw new Error(`Invalid --minutes: ${minutes}. Must be 0-59.`);
        }

        const booking = await client.bookings.create({
          calendarId: opts.calendar,
          resource: {
            id: opts.resourceId,
            type: opts.resourceType,
            label: opts.resourceLabel,
          },
          slot: {
            date: opts.date,
            hour,
            minutes,
          },
        });

        if (outputMode === "json") {
          printJson(booking);
        } else {
          printDetail(booking);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  bookings
    .command("cancel <id>")
    .description("Cancel a booking")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        await client.bookings.cancel(id);

        if (outputMode === "json") {
          printJson({ success: true });
        } else {
          printSuccess(`Booking ${id} cancelled.`);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  bookings
    .command("by-resource <resourceId>")
    .description("List bookings by resource ID")
    .action(async (resourceId: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const result = await client.bookings.listByResource(resourceId);

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result.data, [
            { header: "ID", key: "id" },
            { header: "CALENDAR", key: "calendarId" },
            { header: "DATE", key: "slot.date" },
            { header: "HOUR", key: "slot.hour" },
            { header: "MIN", key: "slot.minutes" },
            { header: "CREATED", key: "createdAt" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
