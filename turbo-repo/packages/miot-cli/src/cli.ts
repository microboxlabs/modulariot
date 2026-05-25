import { createRequire } from "node:module";
import { Command } from "commander";
import { registerAuthCommand } from "./commands/auth/index.js";
import { registerCalendarCommand } from "./commands/calendar/index.js";
import { registerChatCommand } from "./commands/chat/index.js";
import { registerConnectionsCommand } from "./commands/connections/index.js";
import { registerHarnessCommand } from "./commands/harness/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("miot")
  .description("ModularIoT CLI — manage calendars, bookings, slots, and more")
  .version(version)
  .option("--base-url <url>", "API base URL (or MIOT_BASE_URL env)")
  .option("--token <token>", "Auth token (or MIOT_TOKEN env)")
  .option("--organization <id>", "Organization ID (or MIOT_ORGANIZATION_ID env)")
  .option("--profile <name>", "Named profile from ~/.miotrc.json")
  .option("--output <mode>", "Output mode: json or table");

registerAuthCommand(program);
registerCalendarCommand(program);
registerChatCommand(program);
registerConnectionsCommand(program);
registerHarnessCommand(program);

program.parse();
