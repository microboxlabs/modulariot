import type { SlashCommand, SlashResult } from "../registry.js";

export const resetCommand: SlashCommand = {
  name: "reset",
  summary: "Start a new conversation",
  usage: "/reset",
  handle: (): SlashResult => ({ dispatch: { kind: "RESET_CONVERSATION" } }),
};
