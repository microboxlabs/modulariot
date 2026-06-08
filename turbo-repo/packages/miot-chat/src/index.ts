// Library entry point for embedding miot-chat in other Node code
// (e.g. @microboxlabs/miot-cli's `chat` subcommand). The binary in
// dist/cli.js is unaffected; it imports from src/cli.ts directly.

export {
  runMiotChat,
  shouldUseTui,
  type RunMiotChatOptions,
} from "./runMiotChat.js";

export { runAsk, type AskOptions } from "./commands/ask.js";

export {
  resolveConfig,
  readConfig,
  writeConfig,
  getConfigDir,
  getConfigPath,
  DEFAULT_CONFIG,
  type MiotChatConfig,
  type MiotChatProfile,
  type ResolvedConfig,
  type CliFlags,
  type ResolveOptions,
  type ThemeConfig,
} from "./config.js";
