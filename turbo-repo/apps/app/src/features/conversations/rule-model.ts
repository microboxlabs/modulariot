import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type {
  AudienceEntry,
  EventField,
  EventTypeInfo,
  RuleBump,
  RuleSpec,
  RuleStep,
  RuleTrigger,
  SampleEvent,
} from "./conversations-types";

export const SYMPTOM_OPENED = "symptom.case.opened";

/** Audience roles until contacts have a role list (#2007). */
export const ROLES = [
  { value: "driver", label: "roleDriver" },
  { value: "carrier", label: "roleCarrier" },
  { value: "tower_lead", label: "roleTowerLead" },
  { value: "operations_lead", label: "roleOperationsLead" },
];

export const STEP_CHANNELS = [
  { value: "whatsapp", label: "channelWhatsapp" },
  { value: "email", label: "channelEmail" },
  { value: "preferred", label: "channelPreferred" },
  { value: "webhook", label: "channelWebhook" },
  { value: "slack", label: "channelSlack" },
  { value: "teams", label: "channelTeams" },
] as const;

/** Channels a person can answer on, so a step may wait for the reply. */
export const REPLY_CHANNELS = new Set(["whatsapp", "email"]);

const EVENT_LABEL: Record<string, string> = {
  "symptom.case.opened": "eventSymptomCaseOpened",
  "symptom.case.level_changed": "eventSymptomCaseLevelChanged",
  "symptom.case.closed": "eventSymptomCaseClosed",
  "symptom.case.sla_expired": "eventSymptomCaseSlaExpired",
  "trip.alert": "eventTripAlert",
  "trip.milestone.detected": "eventTripMilestoneDetected",
  "trip.milestone.confirmed": "eventTripMilestoneConfirmed",
  "trip.milestone.rejected": "eventTripMilestoneRejected",
  "trip.milestone.conflict": "eventTripMilestoneConflict",
  "trip.feed.closed_changed": "eventTripFeedClosedChanged",
  "conversation.reply_received": "eventConversationReplyReceived",
};

const SUMMARY_LEAD: Record<string, string> = {
  "symptom.case.opened": "summaryOpened",
  "symptom.case.level_changed": "summaryLevelChanged",
  "symptom.case.closed": "summaryClosed",
  "symptom.case.sla_expired": "summarySlaExpired",
};

const EVENT_GROUPS = [
  { prefix: "symptom.", label: "eventGroupSymptoms" },
  { prefix: "trip.", label: "eventGroupTrips" },
  { prefix: "conversation.", label: "eventGroupConversations" },
] as const;

/** The event types under the module that publishes them, in catalog order; unknown prefixes go last. */
export function eventGroups(
  types: string[],
  d: I18nRecord
): { label: string; types: string[] }[] {
  const groups = EVENT_GROUPS.map((g) => ({
    label: trDynamic(g.label, d),
    types: types.filter((t) => t.startsWith(g.prefix)),
  }));
  const other = types.filter(
    (t) => !EVENT_GROUPS.some((g) => t.startsWith(g.prefix))
  );
  return [
    ...groups,
    { label: trDynamic("eventGroupOther", d), types: other },
  ].filter((g) => g.types.length > 0);
}

/** What an event means, for the help under the event picker. */
export function eventDescription(
  type: string,
  d: I18nRecord,
  catalog?: EventTypeInfo[]
): string {
  const key = EVENT_LABEL[type];
  if (key) {
    const desc = key.replace(/^event/, "eventDesc");
    const text = trDynamic(desc, d);
    if (text !== desc) return text;
  }
  return catalog?.find((e) => e.type === type)?.description || type;
}

/** The event with its module, for lists that mix them: "Síntomas · Caso abierto". */
export function eventFullLabel(
  type: string,
  d: I18nRecord,
  catalog?: EventTypeInfo[]
): string {
  const group = eventGroups([type], d)[0]?.label;
  const label = eventLabel(type, d, catalog);
  return group ? `${group} · ${label}` : label;
}

/** An event type in words: the dictionary's, else the catalog's description, else the type. */
export function eventLabel(
  type: string,
  d: I18nRecord,
  catalog?: EventTypeInfo[]
): string {
  const key = EVENT_LABEL[type];
  if (key) return trDynamic(key, d);
  return catalog?.find((e) => e.type === type)?.description || type;
}

export function channelLabel(
  channel: string | null | undefined,
  d: I18nRecord
) {
  if (!channel) return "";
  const text = trDynamic(
    `channel${channel.charAt(0).toUpperCase()}${channel.slice(1)}`,
    d
  );
  return text.startsWith("channel") ? channel : text;
}

export function roleLabel(role: string, d: I18nRecord) {
  const known = ROLES.find((r) => r.value === role.toLowerCase());
  return known ? trDynamic(known.label, d) : role;
}

/** What a rule's condition says about the symptom and its level. */
export interface WhenParts {
  symptomKey: string | null;
  level: { op: "==" | ">="; value: number } | null;
  /** Conditions besides those two. */
  others: number;
}

/** Splits on `&&` outside quotes and parentheses. */
function clauses(when: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < when.length; i++) {
    const c = when[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && when.startsWith("&&", i)) {
      out.push(when.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  out.push(when.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The index of the `)` that closes the `(` at 0, outside quotes; -1 if none. */
function closingParen(s: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Removes parentheses around the whole clause, when they match each other. */
function unwrap(clause: string): string {
  let s = clause.trim();
  while (s.startsWith("(") && closingParen(s) === s.length - 1)
    s = s.slice(1, -1).trim();
  return s;
}

/** The conditions joined by `&&`, also inside parentheses around a group of them. */
function conditions(when: string): string[] {
  return clauses(when).flatMap((raw) => {
    const inner = unwrap(raw);
    return inner !== raw && clauses(inner).length > 1
      ? conditions(inner)
      : [inner];
  });
}

const SYMPTOM_KEY = /^event\.data\.symptomKey\s*==\s*(['"])([^'"]+)\1$/;
const LEVEL = /^event\.data\.level\s*(==|>=|>)\s*(\d+)$/;

export function parseWhen(when: string | null | undefined): WhenParts {
  const out: WhenParts = { symptomKey: null, level: null, others: 0 };
  for (const clause of conditions(when ?? "")) {
    const key = SYMPTOM_KEY.exec(clause);
    const level = LEVEL.exec(clause);
    if (key && !out.symptomKey) out.symptomKey = key[2];
    else if (level && !out.level) {
      const n = Number(level[2]);
      out.level =
        level[1] === ">"
          ? { op: ">=", value: n + 1 }
          : { op: level[1] as "==" | ">=", value: n };
    } else out.others++;
  }
  return out;
}

/** The highest ICU level. */
const TOP_LEVEL = 4;

/**
 * The trigger in plain words: "Cuando se abre una condición de Botón de pánico en
 * Código negro". `symptomName` maps a symptom key to its name.
 */
export function triggerSummary(
  trigger: RuleTrigger | null | undefined,
  d: I18nRecord,
  symptomName: (key: string) => string | undefined = () => undefined,
  catalog?: EventTypeInfo[]
): string {
  if (!trigger?.event) return tr("summaryNoTrigger", d);
  const lead = SUMMARY_LEAD[trigger.event];
  let text = lead
    ? trDynamic(lead, d)
    : tr("summaryEvent", d, { event: eventLabel(trigger.event, d, catalog) });
  const parts = parseWhen(trigger.when);
  if (parts.symptomKey) {
    text += tr("summarySymptom", d, {
      symptom: symptomName(parts.symptomKey) ?? parts.symptomKey,
    });
  }
  if (parts.level) {
    const level = trDynamic(`levelName${parts.level.value}`, d);
    const exact = parts.level.op === "==" || parts.level.value >= TOP_LEVEL;
    text += exact
      ? tr("summaryLevel", d, { level })
      : tr("summaryLevelOrMore", d, { level });
  }
  if (parts.others > 0) text += tr("summaryMore", d);
  return text;
}

/** Whether a rule's trigger names this symptom and reaches this level. */
export function ruleTargets(
  rule: { trigger: RuleTrigger | null; symptomKey?: string | null },
  symptomKey: string,
  icu: number
): boolean {
  if (!rule.trigger?.event.startsWith("symptom.case.")) return false;
  const parts = parseWhen(rule.trigger.when);
  const key = rule.symptomKey ?? parts.symptomKey;
  if (key !== symptomKey) return false;
  if (!parts.level) return true;
  return parts.level.op === "=="
    ? parts.level.value === icu
    : icu >= parts.level.value;
}

export function symptomLevelWhen(symptomKey: string, icu: number) {
  return `event.data.symptomKey == '${symptomKey}' && event.data.level >= ${icu}`;
}

export function emptyStep(): RuleStep {
  return {
    after: 0,
    channel: "whatsapp",
    template: "",
    to: "audience",
    waitForReply: 5,
    onReply: "stop",
  };
}

export function newRuleSpec(event = SYMPTOM_OPENED, when = ""): RuleSpec {
  return {
    trigger: { event, when: when || null },
    audience: [{ role: "driver" }],
    steps: [emptyStep()],
  };
}

/** A spec from the server with every part present. */
export function normalizeSpec(
  spec: Partial<RuleSpec> | null | undefined
): RuleSpec {
  return {
    trigger: {
      event: spec?.trigger?.event ?? "",
      when: spec?.trigger?.when ?? null,
    },
    audience: spec?.audience ?? [],
    steps: (spec?.steps ?? []).map((s) => ({
      ...emptyStep(),
      ...s,
      waitForReply: s.waitForReply ?? 0,
    })),
    family: spec?.family ?? null,
  };
}

export type AudienceKind = "role" | "address" | "path" | "contacts";

export function audienceKind(e: AudienceEntry): AudienceKind {
  if (e.contacts !== undefined) return "contacts";
  if (e.path !== undefined) return "path";
  if (e.address !== undefined) return "address";
  return "role";
}

export function audienceText(e: AudienceEntry, d: I18nRecord): string {
  const kind = audienceKind(e);
  if (kind === "role") return roleLabel(e.role ?? "", d);
  if (kind === "path") return `event.data.${e.path ?? ""}`;
  if (kind === "contacts")
    return tr("audienceContactsText", d, { condition: e.contacts ?? "" });
  return e.name || e.address || "";
}

/** The variables a template can use for an event: its fields and the extra ones. */
export function eventVariables(info: EventTypeInfo | undefined): EventField[] {
  if (!info) return [];
  const seen = new Set<string>();
  return [...(info.variables ?? []), ...info.fields].filter((f) => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
}

/** Values a sample event starts with when the condition does not set them; no real vehicle or place. */
const SAMPLE_DATA: Record<string, unknown> = {
  symptomId: 1,
  version: "1.0.0",
  level: 4,
  previousLevel: 0,
  assetId: "TEST01",
  tripId: "TRIP-TEST",
  driverId: "DRIVER-TEST",
  measure: 1,
  latitude: -33.4489,
  longitude: -70.6693,
  speedKmh: 45,
};

function sampleValue(type: string): unknown {
  const t = type.toLowerCase();
  if (/(int|long|double|float|number|decimal)/.test(t)) return 0;
  if (t.includes("bool")) return false;
  if (t.includes("instant") || t.includes("date") || t.includes("time"))
    return null;
  return "";
}

const VALUE_CLAUSE =
  /^event\.data\.(\w+)\s*(==|>=|>)\s*(?:(['"])(.*)\3|(-?\d+(?:\.\d+)?)|(true|false))$/;

/**
 * The values a condition asks of `event.data`: `field == 'x'`, `field == 3`,
 * `field >= 3` (3) and `field > 3` (4), each the smallest value that holds.
 */
export function conditionValues(
  when: string | null | undefined
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const clause of conditions(when ?? "")) {
    const m = VALUE_CLAUSE.exec(clause);
    if (!m || m[1] in out) continue;
    const [, field, op, , text, num, bool] = m;
    if (text !== undefined) {
      if (op === "==") out[field] = text;
    } else if (num !== undefined) {
      const n = Number(num);
      out[field] = op === ">" ? n + 1 : n;
    } else if (bool !== undefined && op === "==") {
      out[field] = bool === "true";
    }
  }
  return out;
}

/**
 * An event of the trigger's type that the rule would see: the condition's
 * values, test defaults for the rest of the catalog fields, a recent time,
 * and `test: false` so that rules in force match it.
 */
export function sampleEvent(
  trigger: RuleTrigger,
  info: EventTypeInfo | undefined,
  now = new Date()
): SampleEvent {
  const data: Record<string, unknown> = {};
  for (const f of info?.fields ?? []) {
    data[f.name] = Object.hasOwn(SAMPLE_DATA, f.name)
      ? SAMPLE_DATA[f.name]
      : sampleValue(f.type);
  }
  Object.assign(data, conditionValues(trigger.when));
  const key = data.symptomId ?? 1;
  return {
    type: trigger.event,
    context: { kind: info?.contextKind ?? "", key: String(key) },
    data,
    test: false,
    at: now.toISOString(),
  };
}

/** Minutes from the event to a simulated message, for "t+5'". */
export function minutesAfter(at: string | number, eventAt: string): number {
  if (typeof at === "number") return at;
  const start = Date.parse(eventAt);
  const time = Date.parse(at);
  if (Number.isNaN(start) || Number.isNaN(time)) return 0;
  return Math.max(0, Math.round((time - start) / 60_000));
}

export interface RuleChange {
  key: string;
  text: string;
}

/** JSON with object keys sorted, so property order never counts as a change; array order does. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : Number(a > b)));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Collapses runs of whitespace outside quotes; quoted text is kept as written. */
function squash(s: string | null | undefined): string {
  let out = "";
  let quote: string | null = null;
  let space = false;
  const text = (s ?? "").trim();
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === "\\" && i + 1 < text.length) out += text[++i];
      else if (c === quote) quote = null;
    } else if (/\s/.test(c)) {
      space = true;
    } else {
      if (space) out += " ";
      space = false;
      if (c === "'" || c === '"') quote = c;
      out += c;
    }
  }
  return out;
}

/** What the draft changes against the published spec, one line per part. */
export function ruleChanges(
  draft: RuleSpec,
  published: RuleSpec | null | undefined,
  d: I18nRecord
): RuleChange[] {
  if (!published) return [{ key: "first", text: tr("changeFirst", d) }];
  const out: RuleChange[] = [];
  if (draft.trigger.event !== published.trigger.event)
    out.push({ key: "event", text: tr("changeEvent", d) });
  if (squash(draft.trigger.when) !== squash(published.trigger.when))
    out.push({ key: "when", text: tr("changeWhen", d) });
  if (!same(draft.audience, published.audience))
    out.push({ key: "audience", text: tr("changeAudience", d) });
  const n = Math.max(draft.steps.length, published.steps.length);
  for (let i = 0; i < n; i++) {
    const params = { n: String(i + 1) };
    const a = draft.steps[i];
    const b = published.steps[i];
    if (a && !b)
      out.push({ key: `step${i}`, text: tr("changeStepAdded", d, params) });
    else if (!a && b)
      out.push({ key: `step${i}`, text: tr("changeStepRemoved", d, params) });
    else if (!same(a, b))
      out.push({ key: `step${i}`, text: tr("changeStep", d, params) });
  }
  if ((draft.family ?? null) !== (published.family ?? null))
    out.push({ key: "family", text: tr("changeFamily", d) });
  return out;
}

export const RULE_BUMPS: RuleBump[] = ["PATCH", "MINOR", "MAJOR"];

/** The first version a rule publishes. */
export const FIRST_VERSION = "0.1.0";

function stepsMovedOrRerouted(a: RuleStep[], b: RuleStep[]) {
  if (a.length !== b.length) return true;
  if (
    a.some(
      (s, i) =>
        s.channel !== b[i].channel ||
        !same(s.to, b[i].to) ||
        (s.connection ?? null) !== (b[i].connection ?? null)
    )
  )
    return true;
  const sorted = (steps: RuleStep[]) =>
    steps.map(canonical).sort((x, y) => x.localeCompare(y));
  return !same(a, b) && same(sorted(a), sorted(b));
}

/**
 * The bump the draft calls for against the published spec, by the server's rules (RuleBump.java): MAJOR the
 * event; MINOR the condition, the recipients, or steps added, removed, moved or rerouted; PATCH the rest. The
 * first publish is MINOR; null when nothing changed.
 */
export function ruleBump(
  draft: RuleSpec,
  published: RuleSpec | null | undefined
): RuleBump | null {
  if (!published) return "MINOR";
  if (draft.trigger.event !== published.trigger.event) return "MAJOR";
  if (
    squash(draft.trigger.when) !== squash(published.trigger.when) ||
    !same(draft.audience, published.audience) ||
    stepsMovedOrRerouted(draft.steps, published.steps)
  )
    return "MINOR";
  return same(draft.steps, published.steps) &&
    (draft.family ?? null) === (published.family ?? null)
    ? null
    : "PATCH";
}

/** The version a bump makes from the one in force: 0.2.1 + MINOR = 0.3.0; the first is 0.1.0. */
export function nextRuleVersion(current: string | null, bump: RuleBump) {
  if (!current) return FIRST_VERSION;
  const [major = 0, minor = 0, patch = 0] = current.split(".").map(Number);
  if (bump === "MAJOR") return `${major + 1}.0.0`;
  if (bump === "MINOR") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The channels a spec's steps use, in order, without repeats. */
export function specChannels(spec: RuleSpec): string[] {
  return [...new Set(spec.steps.map((s) => s.channel))];
}

/** `{{name}}` parts of a template text, filled from `values`. */
export type TextPart =
  | { text: string }
  | { variable: string; value: string | null };

export function fillText(
  text: string,
  values: Record<string, string>
): TextPart[] {
  const out: TextPart[] = [];
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const name = m[1];
    out.push({
      variable: name,
      value: Object.hasOwn(values, name) ? values[name] : null,
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** The variables a text uses, in order, without repeats. */
export function textVariables(text: string): string[] {
  return [
    ...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1])),
  ];
}
