import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printTable, printDetail } from "../../output.js";
import { handleError } from "../../utils/error.js";
import { parseIntOrThrow, parseOptionalInt } from "../../utils/parse.js";

export function registerTimeWindowsCommand(parent: Command): void {
  const tw = parent
    .command("time-windows")
    .description("Manage calendar time windows");

  tw.command("list")
    .description("List time windows for a calendar")
    .requiredOption("--calendar <id>", "Calendar ID")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as { calendar: string };

        const result = await client.calendars.listTimeWindows(opts.calendar);

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result, [
            { header: "ID", key: "id" },
            { header: "NAME", key: "name" },
            { header: "START", key: "startHour" },
            { header: "END", key: "endHour" },
            { header: "DURATION", key: "slotDurationMinutes" },
            { header: "CAPACITY", key: "capacityPerSlot" },
            { header: "DAYS", key: "daysOfWeek" },
            { header: "VALID FROM", key: "validFrom" },
            { header: "VALID TO", key: "validTo" },
            { header: "ACTIVE", key: "active" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  tw.command("create")
    .description("Create a time window")
    .requiredOption("--calendar <id>", "Calendar ID")
    .requiredOption("--name <name>", "Time window name")
    .requiredOption("--start-hour <hour>", "Start hour")
    .requiredOption("--end-hour <hour>", "End hour")
    .requiredOption("--valid-from <date>", "Valid from date (YYYY-MM-DD)")
    .option("--valid-to <date>", "Valid to date (YYYY-MM-DD)")
    .option("--slot-duration <minutes>", "Slot duration in minutes")
    .option("--capacity <n>", "Capacity per slot")
    .option("--days-of-week <days>", "Days of week (e.g. 1,2,3,4,5)")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          calendar: string;
          name: string;
          startHour: string;
          endHour: string;
          validFrom: string;
          validTo?: string;
          slotDuration?: string;
          capacity?: string;
          daysOfWeek?: string;
        };

        const result = await client.calendars.createTimeWindow(opts.calendar, {
          name: opts.name,
          startHour: parseIntOrThrow(opts.startHour, "--start-hour"),
          endHour: parseIntOrThrow(opts.endHour, "--end-hour"),
          validFrom: opts.validFrom,
          validTo: opts.validTo,
          slotDurationMinutes: parseOptionalInt(opts.slotDuration, "--slot-duration"),
          capacityPerSlot: parseOptionalInt(opts.capacity, "--capacity"),
          daysOfWeek: opts.daysOfWeek,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  tw.command("update <calendarId> <timeWindowId>")
    .description("Update a time window")
    .requiredOption("--name <name>", "Time window name")
    .requiredOption("--start-hour <hour>", "Start hour")
    .requiredOption("--end-hour <hour>", "End hour")
    .requiredOption("--valid-from <date>", "Valid from date (YYYY-MM-DD)")
    .option("--valid-to <date>", "Valid to date (YYYY-MM-DD)")
    .option("--slot-duration <minutes>", "Slot duration in minutes")
    .option("--capacity <n>", "Capacity per slot")
    .option("--days-of-week <days>", "Days of week (e.g. 1,2,3,4,5)")
    .action(
      async (calendarId: string, timeWindowId: string, _opts, cmd) => {
        const { client, outputMode } = getActionContext(cmd);
        try {
          const opts = cmd.opts() as {
            name: string;
            startHour: string;
            endHour: string;
            validFrom: string;
            validTo?: string;
            slotDuration?: string;
            capacity?: string;
            daysOfWeek?: string;
          };

          const result = await client.calendars.updateTimeWindow(
            calendarId,
            timeWindowId,
            {
              name: opts.name,
              startHour: parseIntOrThrow(opts.startHour, "--start-hour"),
              endHour: parseIntOrThrow(opts.endHour, "--end-hour"),
              validFrom: opts.validFrom,
              validTo: opts.validTo,
              slotDurationMinutes: parseOptionalInt(opts.slotDuration, "--slot-duration"),
              capacityPerSlot: parseOptionalInt(opts.capacity, "--capacity"),
              daysOfWeek: opts.daysOfWeek,
            },
          );

          if (outputMode === "json") {
            printJson(result);
          } else {
            printDetail(result);
          }
        } catch (err) {
          handleError(err, outputMode);
        }
      },
    );
}
