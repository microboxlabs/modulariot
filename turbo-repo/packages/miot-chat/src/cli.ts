import { createRequire } from "node:module";
import { Command } from "commander";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("miot-chat")
  .description(
    "Copilot-style agentic chat CLI for miot-harness (SSE streaming).",
  )
  .version(version)
  .option("--base-url <url>", "Harness base URL (or MIOT_CHAT_BASE_URL env)")
  .option("--token <token>", "Auth bearer token (or MIOT_CHAT_TOKEN env)")
  .option("--tenant <id>", "Tenant ID (or MIOT_CHAT_TENANT_ID env)")
  .option("--user <id>", "User ID (or MIOT_CHAT_USER_ID env)")
  .option(
    "--mode <mode>",
    "Dispatch mode: auto | canned | meta | agentic (or MIOT_CHAT_MODE env)",
  )
  .option(
    "--profile <name>",
    "Named profile from ~/.miot-chat/config.json (or MIOT_CHAT_PROFILE env)",
  );

program.parse();
