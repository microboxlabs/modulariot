import type { RunMode } from "@microboxlabs/miot-harness-client";
import type { SlashCommand, SlashResult } from "../registry.js";

const VALID_MODES: readonly RunMode[] = [
  "auto",
  "canned",
  "meta",
  "agentic",
];

export const modeCommand: SlashCommand = {
  name: "mode",
  summary: "Change the run mode (auto/canned/meta/agentic)",
  usage: "/mode <auto|canned|meta|agentic>",
  argSchema: [
    {
      name: "mode",
      required: true,
      choices: VALID_MODES,
    },
  ],
  handle: (args): SlashResult => {
    const value = args[0];
    if (value === undefined) {
      return { error: "usage: /mode <auto|canned|meta|agentic>" };
    }
    if (!VALID_MODES.includes(value as RunMode)) {
      return { error: `unknown mode: ${value}` };
    }
    return { dispatch: { kind: "SET_MODE", mode: value as RunMode } };
  },
};
