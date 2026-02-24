import { Command } from "commander";
import { registerCalendarCommand } from "./commands/calendar/index.js";

const program = new Command();

program
  .name("miot")
  .description("ModularIoT CLI — manage calendars, bookings, slots, and more")
  .version("0.1.0")
  .option("--base-url <url>", "API base URL (or MIOT_BASE_URL env)")
  .option("--token <token>", "Auth token (or MIOT_TOKEN env)")
  .option("--profile <name>", "Named profile from ~/.miotrc.json")
  .option("--output <mode>", "Output mode: json or table");

registerCalendarCommand(program);

program.parse();
