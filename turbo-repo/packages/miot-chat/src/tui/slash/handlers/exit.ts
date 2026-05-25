import type { SlashCommand, SlashResult } from "../registry.js";

export const exitCommand: SlashCommand = {
  name: "exit",
  summary: "Quit the chat",
  usage: "/exit",
  handle: (): SlashResult => ({ abort: true }),
};
