/**
 * The JSON of the conversations API (`/api/v1/orgs/{org}/conversations`):
 * rules, their versions, runs, templates and the event catalog (#2003).
 */

export type RuleState = "OFF" | "TEST" | "ACTIVE";
export type RuleChannel = "whatsapp" | "email" | "preferred";
export type OnReply = "stop" | "continue";
export type RunStatus = "WAITING" | "REPLIED" | "DONE" | "FAILED" | "CANCELLED";

export interface RuleTrigger {
  event: string;
  /** CEL over `event`; empty means always. */
  when: string | null;
}

/** `{role}`, `{address, channel, name}` or `{path}` (a field of `event.data`). */
export interface AudienceEntry {
  role?: string;
  address?: string;
  channel?: string;
  name?: string | null;
  path?: string;
}

export interface RuleStep {
  /** Minutes after the previous step finished waiting. */
  after: number;
  channel: RuleChannel;
  /** A template key. */
  template: string;
  to: "audience" | AudienceEntry[];
  /** Minutes to wait for a reply; 0 does not wait. */
  waitForReply: number;
  onReply: OnReply;
}

export interface RuleSpec {
  trigger: RuleTrigger;
  audience: AudienceEntry[];
  steps: RuleStep[];
}

export interface ConversationRule {
  id: string;
  key: string;
  name: string;
  state: RuleState;
  currentVersion: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RuleSummary extends ConversationRule {
  hasDraft: boolean;
  /** The published trigger, else the draft's. */
  trigger: RuleTrigger | null;
  stepsCount: number;
  channels: string[];
  /** The symptom the trigger names, when the server reads it. */
  symptomKey?: string | null;
}

export interface RuleVersion {
  id: string;
  version: number | null;
  status: "DRAFT" | "PUBLISHED";
  spec: RuleSpec;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface RuleDetail {
  rule: ConversationRule;
  current: RuleVersion | null;
  draft: RuleVersion | null;
  versions: RuleVersion[];
}

export interface RuleFinding {
  /** `trigger`, `audience.N` or `steps.N` (0-based). */
  section: string;
  severity: "ERROR" | "WARNING";
  code?: string;
  params?: Record<string, unknown>;
  /** Spanish text, shown when the app does not know the code. */
  message: string;
  position: number;
}

export interface DraftResult {
  draft: RuleVersion;
  findings: RuleFinding[];
}

export interface Participant {
  address: string;
  channel: string;
  name: string | null;
  role?: string | null;
}

export interface SampleEvent {
  type: string;
  context: { kind: string; key: string };
  data: Record<string, unknown>;
  test: boolean;
  at: string;
}

export interface SimulatedMessage {
  /** 0-based step index. */
  step: number;
  /** ISO time, or minutes after the event. */
  at: string | number;
  channel: string;
  to: Participant | string;
  text: string;
}

export interface Simulation {
  matches: boolean;
  recipients: Participant[];
  messages: SimulatedMessage[];
  findings?: RuleFinding[];
}

export interface WhatsAppVariant {
  metaName: string;
  language: string;
  params: string[];
}

export interface EmailVariant {
  subject: string;
  body: string;
}

export interface TemplateBody {
  name: string;
  baseText: string;
  whatsapp: WhatsAppVariant | null;
  email: EmailVariant | null;
}

export interface ConversationTemplate extends TemplateBody {
  id: string;
  key: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  usedBy?: { id: string; key: string; name: string; state: RuleState }[];
}

export interface EventField {
  /** Relative to `event.data`; the template variable has the same name. */
  name: string;
  label: string;
  description?: string | null;
  type: string;
}

export interface EventTypeInfo {
  type: string;
  source: string;
  description: string;
  contextKind?: string | null;
  fields: EventField[];
  /** Variables templates get besides the fields, such as `patente` or `hora`. */
  variables?: EventField[];
}

export interface RunMessage {
  id: string;
  step: number;
  channel: string;
  to: string;
  toName?: string | null;
  status: string;
  text: string;
  at: string;
}

export interface ConversationRun {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number | null;
  eventId: string | null;
  eventType: string | null;
  contextKind: string | null;
  contextKey: string | null;
  /** Filled only when contextKind is symptom_case. */
  symptomName: string | null;
  assetId: string | null;
  test: boolean;
  status: RunStatus;
  /** Index of the next step. */
  step: number;
  nextAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string | null;
  messages: RunMessage[];
}
