"use client";

/**
 * Client for the conversations API (rules, templates, runs, event catalog)
 * through the app's `/api/conversations/*` proxy. SWR keys are the full proxy
 * URLs. Types are in `conversations-types.ts`.
 */

import useSWR, { mutate } from "swr";
import { controlTowerRequest as request } from "@/features/symptoms/control-tower/control-tower-api";
import type { SymptomFamily } from "@/features/symptoms/maintainer/maintainer-api";
import type {
  ChannelAccount,
  ChannelAccountMode,
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
  ChannelConnection,
  ConnectionChannel,
  TemplateCopyResult,
} from "./conversations-types";

export const CONVERSATIONS_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/conversations`;

export const rulesKey = `${CONVERSATIONS_BASE}/rules`;
export const ruleKey = (id: string) => `${rulesKey}/${encodeURIComponent(id)}`;
export const templatesKey = `${CONVERSATIONS_BASE}/templates`;
export const templateKey = (key: string) =>
  `${templatesKey}/${encodeURIComponent(key)}`;
export const catalogKey = `${CONVERSATIONS_BASE}/events/catalog`;
export const ruleFamiliesKey = `${CONVERSATIONS_BASE}/rule-families`;
export const contactReachKey = `${CONVERSATIONS_BASE}/contact-reach`;
export const connectionChannelKey = (channel: string) =>
  `${CONVERSATIONS_BASE}/channels/${encodeURIComponent(channel)}`;
export const accountsKey = `${CONVERSATIONS_BASE}/accounts`;
/** The WhatsApp templates on Meta of the organization's own connection. */
export const orgMetaTemplatesKey = `${CONVERSATIONS_BASE}/whatsapp-templates`;

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

export function useConversationTemplate(key: string | null) {
  return useSWR<ConversationTemplate>(
    key ? templateKey(key) : null,
    fetcher,
    quiet
  );
}

/** The templates on the WABA, read live from Meta; every 30 s while one is under review. */
export function useMetaTemplates(enabled = true) {
  return useSWR<MetaTemplate[]>(enabled ? orgMetaTemplatesKey : null, fetcher, {
    ...quiet,
    refreshInterval: (list) =>
      list?.some((t) => t.status === "PENDING") ? 30_000 : 0,
  });
}

export function useEventCatalog() {
  return useSWR<EventTypeInfo[]>(catalogKey, fetcher, quiet);
}

/** The organization's rule families; a 404 means it has no such list. */
export function useRuleFamilies() {
  return useSWR<SymptomFamily[]>(ruleFamiliesKey, fetcher, quiet);
}

/** A rule in force that writes to a contact; `always` is false when it depends on the event. */
export interface ContactReachRule {
  ruleId: string;
  name: string;
  state: "TEST" | "ACTIVE";
  always: boolean;
}

/** Contact id to the rules in force that write to it. */
export function useContactReach() {
  return useSWR<Record<string, ContactReachRule[]>>(
    contactReachKey,
    fetcher,
    quiet
  );
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

/** Drops the draft; only a rule with a published version can. */
export function discardRuleDraft(id: string) {
  return request<void>(`${ruleKey(id)}/draft`, { method: "DELETE" });
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

/** Saves a template; only platform owners, in the platform scope, may. */
export function saveTemplate(key: string, body: TemplateBody) {
  return request<ConversationTemplate>(templateKey(key), {
    method: "PUT",
    body,
  });
}

export function createMetaTemplate(draft: MetaTemplateDraft) {
  return request<MetaTemplate>(orgMetaTemplatesKey, {
    method: "POST",
    body: draft,
  });
}

export function editMetaTemplate(id: string, draft: MetaTemplateDraft) {
  return request<MetaTemplate>(
    `${orgMetaTemplatesKey}/${encodeURIComponent(id)}`,
    { method: "PUT", body: draft }
  );
}

/** Deletes one language of the template when `id` is given, else every language. */
export function deleteMetaTemplate(name: string, id?: string) {
  const q = id ? `?id=${encodeURIComponent(id)}` : "";
  return request<void>(
    `${orgMetaTemplatesKey}/${encodeURIComponent(name)}${q}`,
    {
      method: "DELETE",
    }
  );
}

export async function refreshMetaTemplates() {
  await mutate(orgMetaTemplatesKey);
}

/** Refreshes the rule list and, when given, one rule. */
export async function refreshRules(id?: string) {
  await mutate(rulesKey);
  if (id) await mutate(ruleKey(id));
}

export async function refreshTemplates(key?: string) {
  await mutate(templatesKey);
  if (key) await mutate(templateKey(key));
}

/** Reloaded on focus, so a connection created in another tab shows up. */
export function useConnectionChannel(channel: string | null) {
  return useSWR<ConnectionChannel>(
    channel ? connectionChannelKey(channel) : null,
    fetcher,
    { shouldRetryOnError: false }
  );
}

/** A connection of the organization made from the channel's template, through the integrations framework. */
export async function createChannelConnection(
  channel: string,
  body: {
    name: string;
    baseUrl: string;
    credentialProfileId: string | null;
  }
) {
  const created = await request<ChannelConnection>(
    `${connectionChannelKey(channel)}/connections`,
    { method: "POST", body }
  );
  await mutate(connectionChannelKey(channel));
  return created;
}

export function useChannelAccounts(enabled = true) {
  return useSWR<ChannelAccount[]>(enabled ? accountsKey : null, fetcher, {
    shouldRetryOnError: false,
  });
}

export async function setChannelAccountMode(
  channel: string,
  mode: ChannelAccountMode
) {
  const saved = await request<ChannelAccount>(
    `${accountsKey}/${encodeURIComponent(channel)}`,
    { method: "PUT", body: { mode } }
  );
  await mutate(accountsKey);
  return saved;
}

export function useOrgMetaTemplates(enabled = true) {
  return useSWR<MetaTemplate[]>(
    enabled ? orgMetaTemplatesKey : null,
    fetcher,
    quiet
  );
}

/** Submits the platform's WhatsApp templates to the organization's WABA; Meta reviews each one. */
export async function copyPlatformTemplates() {
  const results = await request<TemplateCopyResult[]>(
    `${orgMetaTemplatesKey}/copy`,
    { method: "POST", body: {} }
  );
  await mutate(orgMetaTemplatesKey);
  return results;
}
