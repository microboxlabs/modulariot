import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { RuleFinding, RuleSpec } from "./conversations-types";
import { channelLabel, groupLabel, roleLabel } from "./rule-model";

const SECTION = /^(groups|steps)\.(\d+)$/;

/** `groups.2` → {kind: "groups", index: 2}; the trigger has no index. */
export function findingSection(section: string): {
  kind: "trigger" | "groups" | "steps";
  index: number | null;
} {
  const m = SECTION.exec(section);
  if (!m) return { kind: "trigger", index: null };
  return { kind: m[1] as "groups" | "steps", index: Number(m[2]) };
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A finding of the rule validator in the user's language, as
 * `finding<Code>`. `{n}` is the server's `step`, `entry` or `group` param
 * (1-based), else the section index + 1; `{group}` names the group; roles and
 * channels are named. Without a known code, the server's Spanish message.
 */
export function ruleFindingText(
  f: RuleFinding,
  d: I18nRecord,
  spec?: RuleSpec
): string {
  if (!f.code) return f.message;
  const { kind, index } = findingSection(f.section);
  const params: Record<string, string> = {};
  const number = f.params?.step ?? f.params?.entry ?? f.params?.group;
  if (number != null) params.n = String(number);
  else if (index !== null) params.n = String(index + 1);
  for (const [name, value] of Object.entries(f.params ?? {})) {
    const text = value == null ? "" : String(value);
    if (name === "role") params.role = roleLabel(text, d);
    else if (name === "channel") params.channel = channelLabel(text, d);
    else if (name !== "group") params[name] = text;
  }
  const group =
    kind === "groups" && index !== null ? spec?.groups[index] : undefined;
  if (kind === "groups" && index !== null)
    params.group = group
      ? groupLabel(group, index, d)
      : tr("groupN", d, { n: String(index + 1) });
  const key = `finding${upperFirst(f.code)}`;
  const text = trDynamic(key, d, params);
  return text === key ? f.message : text;
}

/** Codes that are about the step's template. */
const TEMPLATE_CODES = new Set([
  "stepNoTemplate",
  "stepUnknownTemplate",
  "stepTemplateNoChannel",
]);

const CHANNEL_CODES = new Set(["stepBadChannel", "stepWaitNeedsReplies"]);

const CONNECTION_CODES = new Set(["stepNoConnection", "stepUnknownConnection"]);

const GROUPS_CODES = new Set([
  "stepNoRecipients",
  "stepUnknownGroup",
  "stepBadRecipients",
]);

export interface StepIssues {
  messages: string[];
  template: boolean;
  channel: boolean;
  connection: boolean;
  /** The groups the step writes to are missing or unknown. */
  groups: boolean;
}

export interface GroupIssues {
  /** About the group itself: no recipients, no id, unused. */
  messages: string[];
  /** Messages for one of its recipients, by the recipient's index. */
  entries: Record<number, string[]>;
}

export interface PlacedFindings {
  trigger: RuleFinding[];
  groups: Record<number, GroupIssues>;
  steps: Record<number, StepIssues>;
}

/** Each finding beside the control it is about. */
export function placeFindings(
  findings: RuleFinding[] | null | undefined,
  spec: RuleSpec,
  d: I18nRecord
): PlacedFindings {
  const out: PlacedFindings = { trigger: [], groups: {}, steps: {} };
  for (const f of findings ?? []) {
    const { kind, index } = findingSection(f.section);
    if (kind === "trigger" || index === null) {
      out.trigger.push(f);
      continue;
    }
    const text = ruleFindingText(f, d, spec);
    if (kind === "groups") {
      const issues = (out.groups[index] ??= { messages: [], entries: {} });
      const entry = Number(f.params?.entry);
      if (Number.isInteger(entry) && entry > 0)
        (issues.entries[entry - 1] ??= []).push(text);
      else issues.messages.push(text);
      continue;
    }
    const issues = (out.steps[index] ??= {
      messages: [],
      template: false,
      channel: false,
      connection: false,
      groups: false,
    });
    issues.messages.push(text);
    const code = f.code ?? "";
    if (TEMPLATE_CODES.has(code)) issues.template = true;
    if (CHANNEL_CODES.has(code)) issues.channel = true;
    if (CONNECTION_CODES.has(code)) issues.connection = true;
    if (GROUPS_CODES.has(code)) issues.groups = true;
  }
  return out;
}
