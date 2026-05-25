import type { SlashCommand, SlashResult } from "../registry.js";

export const resumeCommand: SlashCommand = {
  name: "resume",
  summary: "Pick a saved session to reload",
  usage: "/resume",
  handle: (): SlashResult => ({ modal: { kind: "resume" } }),
};
