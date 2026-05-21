import type { SlashCommand, SlashResult } from "../registry.js";

export const tenantCommand: SlashCommand = {
  name: "tenant",
  summary: "Switch the active tenant id",
  usage: "/tenant <id>",
  argSchema: [{ name: "tenant", required: true }],
  handle: (args): SlashResult => {
    const value = args[0];
    if (value === undefined || value.length === 0) {
      return { error: "usage: /tenant <id>" };
    }
    return { dispatch: { kind: "SET_TENANT", tenant: value } };
  },
};
