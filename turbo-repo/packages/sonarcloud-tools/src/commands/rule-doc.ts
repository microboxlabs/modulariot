import { Command } from "commander";
import { fetchRule } from "../api/rules-api.js";
import { formatRuleMd } from "../formatters/rule-md.js";
import { formatRuleText, ruleUrl } from "../formatters/rule-text.js";

interface RuleDocOpts {
  token?: string;
  organization: string;
  output: string;
}

export function registerRuleDocCommand(program: InstanceType<typeof Command>): void {
  program
    .command("rule-doc")
    .description("Fetch SonarCloud rule documentation by rule key")
    .arguments("<rule-key>")
    .option(
      "-t, --token <token>",
      "SonarCloud token (default: SONAR_TOKEN env)",
    )
    .option(
      "-g, --organization <org>",
      "SonarCloud organization",
      "microboxlabs",
    )
    .option("-o, --output <format>", "text | md | json | url", "text")
    .action(async (ruleKey: string, opts: RuleDocOpts) => {
      const token = opts.token ?? process.env.SONAR_TOKEN;
      if (!token) {
        console.error("Error: Set SONAR_TOKEN or pass -t TOKEN");
        process.exit(1);
      }

      if (opts.output === "url") {
        console.log(ruleUrl(ruleKey));
        return;
      }

      const data = await fetchRule({
        token,
        ruleKey,
        organization: opts.organization,
      });

      switch (opts.output) {
        case "json":
          console.log(JSON.stringify(data, null, 2));
          break;
        case "md":
          console.log(formatRuleMd(data.rule));
          break;
        default:
          console.log(formatRuleText(data.rule));
          break;
      }
    });
}
