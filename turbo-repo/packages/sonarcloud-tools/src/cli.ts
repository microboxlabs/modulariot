import { Command } from "commander";
import { registerIssuesCommand } from "./commands/issues.js";
import { registerRuleDocCommand } from "./commands/rule-doc.js";

const program = new Command();

program
  .name("sonarcloud-tools")
  .description("SonarCloud CLI tools for fetching issues and rule documentation")
  .version("0.1.0");

registerIssuesCommand(program);
registerRuleDocCommand(program);

program.parse();
