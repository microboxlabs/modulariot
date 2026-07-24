import type { IconType } from "react-icons";
import { HiChatAlt2, HiGlobeAlt, HiMail } from "react-icons/hi";
import { SiWhatsapp } from "react-icons/si";
import Handlebars from "handlebars";

/**
 * Review-process integration — the mockup model.
 *
 * A kanban column can be turned into a *reviewed* stage: when a service in it is
 * approved or rejected, the verdict is pushed to an external channel. This is the
 * standardization the operator asked for — the same review plumbing behind any
 * channel — so the shapes are channel-first:
 *
 *   channel (what to talk to) → credential (how to authenticate) → mapping (a
 *   Handlebars template per channel field, over the task/content/review/session
 *   objects) → an async job that carries it.
 *
 * The mapping is Handlebars, matching how the dashboard dashlets template their
 * data. Each channel field holds a template string like
 * `{{content.integrationMediaId}}`, rendered against a context assembled from the
 * task metadata, the ingested document, the review outcome and the session user.
 *
 * Everything is client-only for now (persisted in localStorage). Swapping onto
 * the real API later means feeding a saved-credentials list into the picker and
 * posting this config to the backend that registers the async job.
 *
 * Public repo: the concrete partner (name, endpoint) stays runtime config. The
 * channel here is a generic "Partner API".
 */

/** When the verdict is forwarded. Rejections first: the origin cares about those. */
export type ReviewTrigger = "on_reject" | "on_review";

export interface ReviewIntegrationConfig {
  readonly enabled: boolean;
  readonly channelId: ReviewChannelId | null;
  readonly credentialId: string | null;
  readonly trigger: ReviewTrigger;
  /** Channel field id → Handlebars template. */
  readonly mappings: Record<string, string>;
  /** Set once the config is saved, to mirror the async_jobs registration. */
  readonly registeredJobId?: string;
  readonly lastRegisteredAt?: string;
}

export const EMPTY_REVIEW_CONFIG: ReviewIntegrationConfig = {
  enabled: false,
  channelId: null,
  credentialId: null,
  trigger: "on_reject",
  mappings: {},
};

/* -------------------------------------------------------------------------- */
/* Channel catalog                                                            */
/* -------------------------------------------------------------------------- */

export type ReviewChannelId = "PARTNER_API" | "N8N_WEBHOOK" | "EMAIL" | "WHATSAPP";

export type ChannelFieldType = "string" | "boolean" | "datetime";

export interface ChannelField {
  readonly id: string;
  /** i18n key under `channels.<channel>.fields`. */
  readonly labelKey: string;
  readonly type: ChannelFieldType;
  readonly required: boolean;
  /**
   * Preselected Handlebars template, seeded when the channel is first chosen so a
   * common mapping doesn't have to be built by hand.
   */
  readonly defaultTemplate?: string;
}

export interface ReviewChannelDescriptor {
  readonly id: ReviewChannelId;
  /** i18n key under `channels.<channel>`. */
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly icon: IconType;
  /** False until a channel is wired — shown in the picker but not selectable. */
  readonly available: boolean;
  /** The channel's data contract: what the outbound payload must carry. */
  readonly fields: readonly ChannelField[];
}

/**
 * The partner review contract, as the mockup understands it. The defaults wire
 * the ingested photo's media id and the review outcome straight through — the
 * mapping an operator would otherwise assemble by hand.
 */
const PARTNER_API_FIELDS: readonly ChannelField[] = [
  {
    id: "guidMultimedia",
    labelKey: "channels.partnerApi.fields.guidMultimedia",
    type: "string",
    required: true,
    defaultTemplate: "{{content.integrationMediaId}}",
  },
  {
    id: "serviceCode",
    labelKey: "channels.partnerApi.fields.serviceCode",
    type: "string",
    required: true,
    defaultTemplate: "{{task.mintral_serviceCode}}",
  },
  {
    id: "aprobado",
    labelKey: "channels.partnerApi.fields.aprobado",
    type: "boolean",
    required: true,
    defaultTemplate: "{{review.verdict}}",
  },
  {
    id: "mensaje",
    labelKey: "channels.partnerApi.fields.mensaje",
    type: "string",
    required: false,
    defaultTemplate: "{{review.comment}}",
  },
  {
    id: "fechaRevision",
    labelKey: "channels.partnerApi.fields.fechaRevision",
    type: "datetime",
    required: false,
    defaultTemplate: "{{review.reviewedAt}}",
  },
  {
    id: "usuarioRevisor",
    labelKey: "channels.partnerApi.fields.usuarioRevisor",
    type: "string",
    required: false,
    defaultTemplate: "{{session.user}}",
  },
];

export const REVIEW_CHANNELS: readonly ReviewChannelDescriptor[] = [
  {
    id: "PARTNER_API",
    nameKey: "channels.partnerApi.name",
    descriptionKey: "channels.partnerApi.description",
    icon: HiChatAlt2,
    available: true,
    fields: PARTNER_API_FIELDS,
  },
  {
    id: "N8N_WEBHOOK",
    nameKey: "channels.n8nWebhook.name",
    descriptionKey: "channels.n8nWebhook.description",
    icon: HiGlobeAlt,
    available: false,
    fields: [],
  },
  {
    id: "EMAIL",
    nameKey: "channels.email.name",
    descriptionKey: "channels.email.description",
    icon: HiMail,
    available: false,
    fields: [],
  },
  {
    id: "WHATSAPP",
    nameKey: "channels.whatsapp.name",
    descriptionKey: "channels.whatsapp.description",
    icon: SiWhatsapp,
    available: false,
    fields: [],
  },
];

export function findChannel(
  id: ReviewChannelId | null
): ReviewChannelDescriptor | undefined {
  return REVIEW_CHANNELS.find((channel) => channel.id === id);
}

/* -------------------------------------------------------------------------- */
/* Variable catalog — the objects a template can read                          */
/* -------------------------------------------------------------------------- */

export type VariableGroupId = "task" | "content" | "review" | "session";

export interface TemplateVariable {
  /** Dotted path without braces, e.g. `task.mintral_serviceCode`. */
  readonly path: string;
  /** i18n key under `variables.<group>`. */
  readonly labelKey: string;
  /** Value used to render the live preview. */
  readonly sample: string;
}

export interface VariableGroup {
  readonly id: VariableGroupId;
  /** i18n key under `variables.groups`. */
  readonly labelKey: string;
  readonly icon: IconType;
  readonly variables: readonly TemplateVariable[];
}

/**
 * The four objects a mapping can pull from. Samples are deliberately generic —
 * this is a public repo, so no real client, tenant or contact data appears.
 */
export const VARIABLE_GROUPS: readonly VariableGroup[] = [
  {
    id: "task",
    labelKey: "variables.groups.task",
    icon: HiChatAlt2,
    variables: [
      { path: "task.mintral_serviceCode", labelKey: "variables.task.serviceCode", sample: "SRV-1649906" },
      { path: "task.mintral_priorityCode", labelKey: "variables.task.priority", sample: "UR" },
      { path: "task.client", labelKey: "variables.task.client", sample: "Cliente Demo" },
      { path: "task.mintral_clientRut", labelKey: "variables.task.clientRut", sample: "11.111.111-1" },
      { path: "task.origin", labelKey: "variables.task.origin", sample: "SCL" },
      { path: "task.destination", labelKey: "variables.task.destination", sample: "ANF" },
      { path: "task.mintral_driver1Name", labelKey: "variables.task.driver", sample: "Conductor Demo" },
      { path: "task.mintral_truckLicensePlate", labelKey: "variables.task.truckPlate", sample: "AA-BB-11" },
      { path: "task.expectedDepartureDate", labelKey: "variables.task.departureDate", sample: "2026-07-16" },
    ],
  },
  {
    id: "content",
    labelKey: "variables.groups.content",
    icon: HiMail,
    variables: [
      { path: "content.integrationMediaId", labelKey: "variables.content.mediaId", sample: "19f8f3a89a1-a8ad5969-48944a06" },
      { path: "content.integrationSource", labelKey: "variables.content.source", sample: "app_operaciones" },
      { path: "content.integrationReasonCode", labelKey: "variables.content.reasonCode", sample: "Service_Ready_To_Depart_Onsite" },
      { path: "content.integratedAt", labelKey: "variables.content.integratedAt", sample: "2026-07-16T12:00:00Z" },
      { path: "content.fileName", labelKey: "variables.content.fileName", sample: "onsite_frontal.jpeg" },
      { path: "content.mimeType", labelKey: "variables.content.mimeType", sample: "image/jpeg" },
    ],
  },
  {
    id: "review",
    labelKey: "variables.groups.review",
    icon: HiChatAlt2,
    variables: [
      { path: "review.verdict", labelKey: "variables.review.verdict", sample: "false" },
      { path: "review.decision", labelKey: "variables.review.decision", sample: "rechazado" },
      { path: "review.comment", labelKey: "variables.review.comment", sample: "Falta señalética en la carga" },
      { path: "review.reviewer", labelKey: "variables.review.reviewer", sample: "revisor.demo" },
      { path: "review.reviewedAt", labelKey: "variables.review.reviewedAt", sample: "2026-07-16T14:30:00Z" },
    ],
  },
  {
    id: "session",
    labelKey: "variables.groups.session",
    icon: HiMail,
    variables: [
      { path: "session.user", labelKey: "variables.session.user", sample: "usuario.demo" },
      { path: "session.email", labelKey: "variables.session.email", sample: "usuario.demo@example.com" },
      { path: "session.fullName", labelKey: "variables.session.fullName", sample: "Usuario Demo" },
    ],
  },
];

/**
 * The context a template renders against, built from every variable's sample and
 * nested by group (`{ task: {...}, content: {...}, ... }`). Stands in for the
 * runtime payload the backend will assemble per event.
 */
export function buildSampleContext(): Record<string, Record<string, string>> {
  const context: Record<string, Record<string, string>> = {};
  for (const group of VARIABLE_GROUPS) {
    const bucket: Record<string, string> = {};
    for (const variable of group.variables) {
      const key = variable.path.slice(group.id.length + 1); // strip "group."
      bucket[key] = variable.sample;
    }
    context[group.id] = bucket;
  }
  return context;
}

/**
 * Renders a Handlebars template against a context. Plain substitution for now
 * (no helpers registered); returns the raw template on a compile error so the
 * operator still sees what they typed.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  if (!template) return "";
  try {
    return Handlebars.compile(template, { noEscape: true })(context);
  } catch {
    return template;
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Seeds a channel's mappings from its field defaults when it is selected. */
export function seedMappings(
  channel: ReviewChannelDescriptor
): Record<string, string> {
  const seeded: Record<string, string> = {};
  for (const field of channel.fields) {
    if (field.defaultTemplate) seeded[field.id] = field.defaultTemplate;
  }
  return seeded;
}

/** A required field is unmapped when its template is empty or blank. */
export function unmappedRequiredFields(
  channel: ReviewChannelDescriptor,
  mappings: Record<string, string>
): ChannelField[] {
  return channel.fields.filter(
    (field) => field.required && !mappings[field.id]?.trim()
  );
}
