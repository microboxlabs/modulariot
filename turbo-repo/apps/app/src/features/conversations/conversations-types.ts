/**
 * The JSON of the conversations API (`/api/v1/orgs/{org}/conversations`):
 * rules, their versions, runs, templates and the event catalog (#2003).
 */

export type RuleState = "OFF" | "TEST" | "ACTIVE";
export type RuleChannel =
  | "whatsapp"
  | "email"
  | "preferred"
  | "webhook"
  | "slack"
  | "teams";
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
  /** A template key; optional on a step that calls a connection. */
  template: string;
  /** The integration connection a Webhook, Slack or Teams step calls. */
  connection?: string;
  to: "audience" | AudienceEntry[];
  /** Minutes to wait for a reply; 0 does not wait. */
  waitForReply: number;
  onReply: OnReply;
}

export interface RuleSpec {
  trigger: RuleTrigger;
  audience: AudienceEntry[];
  steps: RuleStep[];
  /** A communication_families value from Ajustes › Seleccionables. */
  family?: string | null;
}

export interface ConversationRule {
  id: string;
  key: string;
  name: string;
  state: RuleState;
  /** The semantic version in force, such as `0.2.1`; null before the first publish. */
  currentVersion: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** MAJOR: the event. MINOR: condition, recipients, steps added, removed, moved or rerouted. PATCH: the rest. */
export type RuleBump = "PATCH" | "MINOR" | "MAJOR";

/** What publishing the draft would do; both null when the draft equals the version in force. */
export interface PublishPlan {
  bump: RuleBump | null;
  nextVersion: string | null;
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
  version: string | null;
  bump?: RuleBump | null;
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
  /** Null without a draft. */
  plan?: PublishPlan | null;
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

/** A platform template: every organization's rules send it. */
export interface ConversationTemplate extends TemplateBody {
  id: string;
  key: string;
  /** Semantic version, raised on each save that changes the template. */
  version?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  /** The reader's rules that use it; the platform also gets each rule's organization. */
  usedBy?: {
    id: string;
    key: string;
    name: string;
    state: RuleState;
    tenantCode?: string;
  }[];
}

/** A template's review state on Meta. */
export type MetaTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "PENDING_DELETION"
  | "DELETED"
  | "LIMIT_EXCEEDED";

export type MetaTemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type MetaButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";

export interface MetaTemplateButton {
  type: MetaButtonType;
  text: string;
  url?: string | null;
  phoneNumber?: string | null;
}

/** A template on the WABA, from `/whatsapp-templates`. */
export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: MetaTemplateCategory | string;
  status: MetaTemplateStatus | string;
  rejectedReason: string | null;
  parameterFormat: string;
  /** TEXT, IMAGE, VIDEO, DOCUMENT or LOCATION; null without a header. */
  headerFormat: string | null;
  header: string | null;
  body: string | null;
  footer: string | null;
  buttons: MetaTemplateButton[];
  /** The body's parameters in order: what a send fills. */
  params: string[];
  /** The example of every header and body parameter. */
  examples: Record<string, string>;
}

/** What the editor submits; Meta keeps the name and language of an existing template. */
export interface MetaTemplateDraft {
  name: string;
  language: string;
  category: MetaTemplateCategory;
  header: string;
  body: string;
  footer: string;
  buttons: MetaTemplateButton[];
  examples: Record<string, string>;
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
  ruleVersion: string | null;
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

/** An organization connection a step on a connection channel can call. */
export interface ChannelConnection {
  id: string;
  name: string;
  /** Only the host: the full URL can carry the webhook's secret. */
  host: string | null;
  status: string;
  lastTestedAt: string | null;
  lastTestResult: boolean | null;
}

/** A channel delivered through connections: the body each of them receives, and the connections. */
export type ChannelAccountMode = "PLATFORM" | "OWN";

/** Which account the rules send a channel from, from `/accounts`. */
export interface ChannelAccount {
  channel: "whatsapp" | "email";
  mode: ChannelAccountMode;
  /** The organization has an active connection for the channel. */
  ownConnected: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** What copying one platform template to the organization's WABA did. */
export interface TemplateCopyResult {
  name: string;
  language: string | null;
  status: "COPIED" | "EXISTS" | "FAILED";
  error: string | null;
}

export interface ConnectionChannel {
  operation: string;
  requestSchema: Record<string, unknown>;
  connections: ChannelConnection[];
}
