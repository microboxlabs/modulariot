import type { SlashCommand, SlashResult } from "../registry.js";

export const themeCommand: SlashCommand = {
  name: "theme",
  summary: "Pick or set the active color theme",
  usage: "/theme [name]",
  handle: (args): SlashResult => {
    const name = args[0];
    if (name && name.length > 0) {
      return { modal: { kind: "theme", payload: { name } } };
    }
    return { modal: { kind: "theme" } };
  },
};
