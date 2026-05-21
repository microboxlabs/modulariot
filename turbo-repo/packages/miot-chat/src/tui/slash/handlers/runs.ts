import type { SlashCommand, SlashResult } from "../registry.js";

export const runsCommand: SlashCommand = {
  name: "runs",
  summary: "Pick a recent run to replay",
  usage: "/runs",
  handle: (): SlashResult => ({ modal: { kind: "runs" } }),
};
