import { z } from "zod/v3";
import type { RulePreset } from "./conversations-types";

const entry = z.object({
  role: z.string().optional(),
  address: z.string().optional(),
  channel: z.string().optional(),
  name: z.string().nullable().optional(),
  path: z.string().optional(),
  contacts: z.string().optional(),
});
const spec = z.object({
  trigger: z.object({
    event: z.string().min(1),
    when: z.string().nullable().optional().default(null),
  }),
  groups: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().nullable().optional(),
      entries: z.array(entry),
    })
  ),
  steps: z.array(
    z.object({
      after: z.number().finite().nonnegative(),
      channel: z.enum([
        "whatsapp",
        "email",
        "preferred",
        "webhook",
        "slack",
        "teams",
      ]),
      template: z.string().optional().default(""),
      connection: z.string().optional(),
      to: z.array(z.string()),
      waitForReply: z.number().finite().nonnegative(),
      onReply: z.enum(["stop", "continue"]).optional().default("stop"),
    })
  ),
  family: z.string().nullable().optional(),
});
const presets = z.array(
  z.object({
    key: z.string().min(1),
    name: z.string(),
    description: z.string(),
    spec,
  })
);

export function parseRulePresets(payload: unknown): RulePreset[] {
  return presets.parse(payload);
}
