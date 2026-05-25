import type { SlashCommand, SlashResult } from "../registry.js";

export const clearCommand: SlashCommand = {
  name: "clear",
  summary: "Clear the transcript",
  usage: "/clear",
  handle: (): SlashResult => ({ dispatch: { kind: "CLEAR" } }),
};
