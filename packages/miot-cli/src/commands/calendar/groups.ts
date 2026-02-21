import type { Command } from "commander";
import { getActionContext } from "../../action-context.js";
import { printJson, printTable, printDetail, printSuccess } from "../../output.js";
import { handleError } from "../../utils/error.js";

export function registerGroupsCommand(parent: Command): void {
  const groups = parent
    .command("groups")
    .description("Manage calendar groups");

  groups
    .command("list")
    .description("List calendar groups")
    .option("--active", "Show only active groups")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as { active?: boolean };

        const result = await client.groups.list({
          active: opts.active,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result as unknown as Record<string, unknown>[], [
            { header: "ID", key: "id" },
            { header: "CODE", key: "code" },
            { header: "NAME", key: "name" },
            { header: "ACTIVE", key: "active" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  groups
    .command("get <id>")
    .description("Get a group by ID")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const group = await client.groups.get(id);

        if (outputMode === "json") {
          printJson(group);
        } else {
          printDetail(group as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  groups
    .command("create")
    .description("Create a calendar group")
    .requiredOption("--code <code>", "Group code")
    .requiredOption("--name <name>", "Group name")
    .option("--description <desc>", "Description")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          code: string;
          name: string;
          description?: string;
        };

        const group = await client.groups.create({
          code: opts.code,
          name: opts.name,
          description: opts.description,
        });

        if (outputMode === "json") {
          printJson(group);
        } else {
          printDetail(group as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  groups
    .command("update <id>")
    .description("Update a calendar group")
    .option("--code <code>", "Group code")
    .option("--name <name>", "Group name")
    .option("--description <desc>", "Description")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          code?: string;
          name?: string;
          description?: string;
        };

        const group = await client.groups.update(id, {
          code: opts.code!,
          name: opts.name!,
          description: opts.description,
        });

        if (outputMode === "json") {
          printJson(group);
        } else {
          printDetail(group as unknown as Record<string, unknown>);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  groups
    .command("deactivate <id>")
    .description("Deactivate a calendar group")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        await client.groups.deactivate(id);

        if (outputMode === "json") {
          printJson({ success: true });
        } else {
          printSuccess(`Group ${id} deactivated.`);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
