import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printTable, printDetail, printSuccess } from "../../output.js";
import { handleError } from "../../utils/error.js";

export function registerSlotManagersCommand(parent: Command): void {
  const sm = parent
    .command("slot-managers")
    .description("Manage slot managers");

  sm.command("list")
    .description("List slot managers")
    .option("--active", "Show only active managers")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as { active?: boolean };

        const result = await client.slotManagers.list({
          active: opts.active,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result as unknown as Record<string, unknown>[], [
            { header: "ID", key: "id" },
            { header: "CALENDAR", key: "calendarCode" },
            { header: "ACTIVE", key: "active" },
            { header: "DAYS AHEAD", key: "daysInAdvance" },
            { header: "BATCH", key: "batchDays" },
            { header: "LAST RUN", key: "lastRunAt" },
            { header: "STATUS", key: "lastRunStatus" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  sm.command("get <id>")
    .description("Get a slot manager by ID")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const manager = await client.slotManagers.get(id);

        if (outputMode === "json") {
          printJson(manager);
        } else {
          printDetail(manager as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  sm.command("create")
    .description("Create a slot manager")
    .requiredOption("--calendar <id>", "Calendar ID")
    .option("--days-in-advance <n>", "Days in advance")
    .option("--batch-days <n>", "Batch days")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          calendar: string;
          daysInAdvance?: string;
          batchDays?: string;
        };

        const manager = await client.slotManagers.create({
          calendarId: opts.calendar,
          daysInAdvance: opts.daysInAdvance
            ? parseInt(opts.daysInAdvance, 10)
            : undefined,
          batchDays: opts.batchDays
            ? parseInt(opts.batchDays, 10)
            : undefined,
        });

        if (outputMode === "json") {
          printJson(manager);
        } else {
          printDetail(manager as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  sm.command("update <id>")
    .description("Update a slot manager")
    .option("--days-in-advance <n>", "Days in advance")
    .option("--batch-days <n>", "Batch days")
    .option("--active", "Set active")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          daysInAdvance?: string;
          batchDays?: string;
          active?: boolean;
        };

        const manager = await client.slotManagers.update(id, {
          calendarId: "", // required by SDK, server ignores on update
          daysInAdvance: opts.daysInAdvance
            ? parseInt(opts.daysInAdvance, 10)
            : undefined,
          batchDays: opts.batchDays
            ? parseInt(opts.batchDays, 10)
            : undefined,
          active: opts.active,
        });

        if (outputMode === "json") {
          printJson(manager);
        } else {
          printDetail(manager as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  sm.command("deactivate <id>")
    .description("Deactivate a slot manager")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        await client.slotManagers.deactivate(id);

        if (outputMode === "json") {
          printJson({ success: true });
        } else {
          printSuccess(`Slot manager ${id} deactivated.`);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  sm.command("run [id]")
    .description("Run slot manager(s). If no ID, runs all.")
    .action(async (id: string | undefined, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        if (id) {
          const result = await client.slotManagers.run(id);
          if (outputMode === "json") {
            printJson(result);
          } else {
            printDetail(result as unknown as Record<string, unknown>);
          }
        } else {
          const results = await client.slotManagers.runAll();
          if (outputMode === "json") {
            printJson(results);
          } else {
            printTable(results as unknown as Record<string, unknown>[], [
              { header: "ID", key: "id" },
              { header: "MANAGER", key: "managerId" },
              { header: "STATUS", key: "status" },
              { header: "CREATED", key: "slotsCreated" },
              { header: "SKIPPED", key: "slotsSkipped" },
            ]);
          }
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  sm.command("runs [managerId]")
    .description("List slot manager runs. If no ID, lists all.")
    .option("--limit <n>", "Limit results")
    .action(async (managerId: string | undefined, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as { limit?: string };
        const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;

        let results;
        if (managerId) {
          results = await client.slotManagers.listRuns(managerId, { limit });
        } else {
          results = await client.slotManagers.listAllRuns({ limit });
        }

        if (outputMode === "json") {
          printJson(results);
        } else {
          printTable(results as unknown as Record<string, unknown>[], [
            { header: "ID", key: "id" },
            { header: "MANAGER", key: "managerId" },
            { header: "STATUS", key: "status" },
            { header: "STARTED", key: "startedAt" },
            { header: "FINISHED", key: "finishedAt" },
            { header: "CREATED", key: "slotsCreated" },
            { header: "SKIPPED", key: "slotsSkipped" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
