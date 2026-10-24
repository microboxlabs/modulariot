import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type {
  AudienceEntry,
  RuleFinding,
  RuleSpec,
} from "./conversations-types";
import { channelLabel, roleLabel } from "./rule-model";

const SECTION = /^(audience|steps)\.(\d+)$/;

/** `audience.2` → {kind: "audience", index: 2}; the trigger has no index. */
export function findingSection(section: string): {
  kind: "trigger" | "audience" | "steps";
  index: number | null;
} {
  const m = SECTION.exec(section);
  if (!m) return { kind: "trigger", index: null };
  return { kind: m[1] as "audience" | "steps", index: Number(m[2]) };
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A finding of the rule validator in the user's language, as
 * `finding<Code>`. The step or recipient number `{n}` is the server's
 * `step` or `entry` param (1-based), else the section index + 1; roles and
 * channels are named. Without a known code, the server's Spanish message.
 */
export function ruleFindingText(f: RuleFinding, d: I18nRecord): string {
  if (!f.code) return f.message;
  const { index } = findingSection(f.section);
  const params: Record<string, string> = {};
  const number = f.params?.step ?? f.params?.entry;
  if (number != null) params.n = String(number);
  else if (index !== null) params.n = String(index + 1);
  for (const [name, value] of Object.entries(f.params ?? {})) {
    const text = value == null ? "" : String(value);
    if (name === "role") params.role = roleLabel(text, d);
    else if (name === "channel") params.channel = channelLabel(text, d);
    else params[name] = text;
  }
  const key = `finding${upperFirst(f.code)}`;
  const text = trDynamic(key, d, params);
  return text === key ? f.message : text;
}

/** Codes about one recipient; in a step they name one of its own recipients. */
const RECIPIENT_CODES = new Set([
  "unknownRole",
  "audienceBadChannel",
  "audienceEmptyEntry",
]);

/** Codes that are about the step's template. */
const TEMPLATE_CODES = new Set([
  "stepNoTemplate",
  "stepUnknownTemplate",
  "stepTemplateNoChannel",
]);

const CHANNEL_CODES = new Set(["stepBadChannel", "stepWaitNeedsReplies"]);

const CONNECTION_CODES = new Set(["stepWebhookNoConnection"]);

/** The recipient a recipient finding is about, matched by its params. */
function recipientIndex(f: RuleFinding, entries: AudienceEntry[]): number {
  const p = f.params ?? {};
  if (f.code === "unknownRole") {
    const role = String(p.role ?? "").toLowerCase();
    return entries.findIndex((e) => (e.role ?? "").toLowerCase() === role);
  }
  if (f.code === "audienceBadChannel") {
    return entries.findIndex((e) => e.address === p.address);
  }
  return entries.findIndex(
    (e) => !e.role && e.address === undefined && !e.path
  );
}

export interface StepIssues {
  messages: string[];
  template: boolean;
  channel: boolean;
  connection: boolean;
  /** Messages for the step's own recipients, by their index. */
  entries: Record<number, string[]>;
}

export interface PlacedFindings {
  trigger: RuleFinding[];
  /** Messages for the rule's recipients, by their index. */
  audience: Record<number, string[]>;
  /** Audience findings with no row to sit beside, such as no recipients at all. */
  audienceGeneral: string[];
  steps: Record<number, StepIssues>;
}

const push = (map: Record<number, string[]>, i: number, text: string) => {
  (map[i] ??= []).push(text);
};

/** Each finding beside the control it is about. */
export function placeFindings(
  findings: RuleFinding[] | null | undefined,
  spec: RuleSpec,
  d: I18nRecord
): PlacedFindings {
  const out: PlacedFindings = {
    trigger: [],
    audience: {},
    audienceGeneral: [],
    steps: {},
  };
  for (const f of findings ?? []) {
    const { kind, index } = findingSection(f.section);
    const text = ruleFindingText(f, d);
    if (kind === "trigger" || index === null) {
      out.trigger.push(f);
    } else if (kind === "audience") {
      if (index < spec.audience.length) push(out.audience, index, text);
      else out.audienceGeneral.push(text);
    } else {
      const issues = (out.steps[index] ??= {
        messages: [],
        template: false,
        channel: false,
        connection: false,
        entries: {},
      });
      const to = spec.steps[index]?.to;
      const entry =
        RECIPIENT_CODES.has(f.code ?? "") && Array.isArray(to)
          ? recipientIndex(f, to)
          : -1;
      if (entry >= 0) push(issues.entries, entry, text);
      else issues.messages.push(text);
      if (TEMPLATE_CODES.has(f.code ?? "")) issues.template = true;
      if (CHANNEL_CODES.has(f.code ?? "")) issues.channel = true;
      if (CONNECTION_CODES.has(f.code ?? "")) issues.connection = true;
    }
  }
  return out;
}
