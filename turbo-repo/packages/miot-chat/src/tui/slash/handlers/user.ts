import type { SlashCommand, SlashResult } from "../registry.js";

export const userCommand: SlashCommand = {
  name: "user",
  summary: "Set the active user id",
  usage: "/user <id>",
  argSchema: [{ name: "user", required: true }],
  handle: (args): SlashResult => {
    const value = args[0];
    if (value === undefined || value.length === 0) {
      return { error: "usage: /user <id>" };
    }
    return { dispatch: { kind: "SET_USER", user: value } };
  },
};
