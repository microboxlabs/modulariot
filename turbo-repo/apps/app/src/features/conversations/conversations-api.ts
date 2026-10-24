"use client";

/**
 * Client for the conversations API (rules, templates, runs, event catalog)
 * through the app's `/api/conversations/*` proxy. SWR keys are the full proxy
 * URLs. Types are in `conversations-types.ts`.
 */

import useSWR, { mutate } from "swr";
import { controlTowerRequest as request } from "@/features/symptoms/control-tower/control-tower-api";
import type {
  ConversationRun,
  ConversationRule,
  ConversationTemplate,
  DraftResult,
  EventTypeInfo,
  MetaTemplate,
  MetaTemplateDraft,
  RuleBump,
  RuleDetail,
  RuleSpec,
  RuleState,
  RuleSummary,
  RuleVersion,
  RunStatus,
  SampleEvent,
  Simulation,
  TemplateBody,
  WebhookChannel,
  WebhookConnection,
} from "./conversations-types";

export const CONVERSATIONS_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/conversations`;

export const rulesKey = `${CONVERSATIONS_BASE}/rules`;
export const ruleKey = (id: string) => `${rulesKey}/${encodeURIComponent(id)}`;
export const templatesKey = `${CONVERSATIONS_BASE}/templates`;
export const templateKey = (key: string) =>
  `${templatesKey}/${encodeURIComponent(key)}`;
/** The platform's templates, for platform owners; organizations read them through `templatesKey`. */
export const platformTemplatesKey = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/platform/message-templates`;
export const platformTemplateKey = (key: string) =>
  `${platformTemplatesKey}/${encodeURIComponent(key)}`;
export const catalogKey = `${CONVERSATIONS_BASE}/events/catalog`;
export const webhookChannelKey = `${CONVERSATIONS_BASE}/channels/webhook`;
/** The WhatsApp templates on Meta of the platform's connection, for platform owners. */
export const metaTemplatesKey = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/platform/whatsapp-templates`;

export function runsKey(filter: {
  rule?: string | null;
  status?: RunStatus | null;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (filter.rule) q.set("rule", filter.rule);
  if (filter.status) q.set("status", filter.status);
  q.set("limit", String(filter.limit ?? 50));
  return `${CONVERSATIONS_BASE}/runs?${q.toString()}`;
}

const fetcher = <T>(url: string) => request<T>(url);
const quiet = { revalidateOnFocus: false, shouldRetryOnError: false };

/** The organization's rules; nothing is fetched while `enabled` is false. */
export function useConversationRules(enabled = true) {
  return useSWR<RuleSummary[]>(enabled ? rulesKey : null, fetcher, quiet);
}

export function useConversationRule(id: string | null) {
  return useSWR<RuleDetail>(id ? ruleKey(id) : null, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useConversationTemplates(enabled = true) {
  return useSWR<ConversationTemplate[]>(
    enabled ? templatesKey : null,
    fetcher,
    quiet
  );
}

/** The platform's templates with every organization's rules that use each. */
export function usePlatformTemplates(enabled = true) {
  return useSWR<ConversationTemplate[]>(
    enabled ? platformTemplatesKey : null,
    fetcher,
    quiet
  );
}

export function usePlatformTemplate(key: string | null) {
  return useSWR<ConversationTemplate>(
    key ? platformTemplateKey(key) : null,
    fetcher,
    quiet
  );
}

export function useConversationTemplate(key: string | null) {
  return useSWR<ConversationTemplate>(
    key ? templateKey(key) : null,
    fetcher,
    quiet
  );
}

/** The templates on the WABA, read live from Meta; every 30 s while one is under review. */
export function useMetaTemplates(enabled = true) {
  return useSWR<MetaTemplate[]>(enabled ? metaTemplatesKey : null, fetcher, {
    ...quiet,
    refreshInterval: (list) =>
      list?.some((t) => t.status === "PENDING") ? 30_000 : 0,
  });
}

export function useEventCatalog() {
  return useSWR<EventTypeInfo[]>(catalogKey, fetcher, quiet);
}

export function useConversationRuns(filter: {
  rule?: string | null;
  status?: RunStatus | null;
  limit?: number;
}) {
  return useSWR<ConversationRun[]>(runsKey(filter), fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 15_000,
  });
}

export function createRule(body: {
  key: string;
  name: string;
  spec?: RuleSpec;
}) {
  return request<RuleDetail>(rulesKey, { method: "POST", body });
}

export function saveRuleDraft(id: string, spec: RuleSpec) {
  return request<DraftResult>(`${ruleKey(id)}/draft`, {
    method: "PUT",
    body: { spec },
  });
}

/** `bump` raises the computed bump; null keeps it. */
export function publishRule(
  id: string,
  reason: string,
  bump: RuleBump | null = null
) {
  return request<RuleVersion>(`${ruleKey(id)}/publish`, {
    method: "POST",
    body: { reason, bump },
  });
}

export function setRuleState(id: string, state: RuleState) {
  return request<ConversationRule>(`${ruleKey(id)}/state`, {
    method: "PUT",
    body: { state },
  });
}

export function simulateRule(id: string, event: SampleEvent) {
  return request<Simulation>(`${ruleKey(id)}/simulate`, {
    method: "POST",
    body: { event },
  });
}

/** Saves a platform template; only platform owners may. */
export function saveTemplate(key: string, body: TemplateBody) {
  return request<ConversationTemplate>(platformTemplateKey(key), {
    method: "PUT",
    body,
  });
}

export function createMetaTemplate(draft: MetaTemplateDraft) {
  return request<MetaTemplate>(metaTemplatesKey, {
    method: "POST",
    body: draft,
  });
}

export function editMetaTemplate(id: string, draft: MetaTemplateDraft) {
  return request<MetaTemplate>(
    `${metaTemplatesKey}/${encodeURIComponent(id)}`,
    { method: "PUT", body: draft }
  );
}

/** Deletes one language of the template when `id` is given, else every language. */
export function deleteMetaTemplate(name: string, id?: string) {
  const q = id ? `?id=${encodeURIComponent(id)}` : "";
  return request<void>(`${metaTemplatesKey}/${encodeURIComponent(name)}${q}`, {
    method: "DELETE",
  });
}

export async function refreshMetaTemplates() {
  await mutate(metaTemplatesKey);
}

/** Refreshes the rule list and, when given, one rule. */
export async function refreshRules(id?: string) {
  await mutate(rulesKey);
  if (id) await mutate(ruleKey(id));
}

export async function refreshTemplates(key?: string) {
  await mutate(templatesKey);
  await mutate(platformTemplatesKey);
  if (key) {
    await mutate(templateKey(key));
    await mutate(platformTemplateKey(key));
  }
}

export function useWebhookChannel(enabled = true) {
  return useSWR<WebhookChannel>(
    enabled ? webhookChannelKey : null,
    fetcher,
    quiet
  );
}

/** A connection of the organization made from the webhook contract, through the integrations framework. */
export async function createWebhookConnection(body: {
  name: string;
  baseUrl: string;
  credentialProfileId: string | null;
}) {
  const created = await request<WebhookConnection>(
    `${webhookChannelKey}/connections`,
    { method: "POST", body }
  );
  await mutate(webhookChannelKey);
  return created;
}
