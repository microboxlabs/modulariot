import type { Command } from "commander";
import { getHarnessActionContext } from "../../harness-context.js";
import { printJson, printTable } from "../../output.js";
import { handleError } from "../../utils/error.js";

interface SkillsOpts {
  tenant?: string;
}

/** Truncate trigger text so the table stays readable on one line. */
function truncate(value: string, max = 72): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

export function registerHarnessSkillsCommand(parent: Command): void {
  parent
    .command("skills")
    .description("List the skills the harness exposes (GET /skills).")
    .option("--tenant <id>", "Tenant ID to scope the skill list")
    .action(async (opts: SkillsOpts, cmd: Command) => {
      const { client, outputMode } = getHarnessActionContext(cmd);
      try {
        const skills = await client.skills.list({
          ...(opts.tenant !== undefined && { tenant: opts.tenant }),
        });
        if (outputMode === "json") {
          printJson(skills);
        } else {
          const rows = skills.map((s) => ({
            ...s,
            when_to_use: truncate(s.when_to_use || s.description),
          }));
          printTable(rows, [
            { header: "ID", key: "id" },
            { header: "NAME", key: "name" },
            { header: "SCOPE", key: "scope" },
            { header: "SOURCE", key: "source" },
            { header: "WHEN TO USE", key: "when_to_use" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
