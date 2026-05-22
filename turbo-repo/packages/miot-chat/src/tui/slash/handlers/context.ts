import type { SlashCommand, SlashResult } from "../registry.js";

export const contextCommand: SlashCommand = {
  name: "context",
  summary: "Show session context modal",
  usage: "/context",
  handle: (): SlashResult => ({ modal: { kind: "context" } }),
};
