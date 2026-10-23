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
  RuleDetail,
  RuleSpec,
  RuleState,
  RuleSummary,
  RuleVersion,
  RunStatus,
  SampleEvent,
  Simulation,
  TemplateBody,
} from "./conversations-types";

export const CONVERSATIONS_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/conversations`;

export const rulesKey = `${CONVERSATIONS_BASE}/rules`;
export const ruleKey = (id: string) => `${rulesKey}/${encodeURIComponent(id)}`;
export const templatesKey = `${CONVERSATIONS_BASE}/templates`;
export const templateKey = (key: string) =>
  `${templatesKey}/${encodeURIComponent(key)}`;
export const catalogKey = `${CONVERSATIONS_BASE}/events/catalog`;

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

export function publishRule(id: string, reason: string) {
  return request<RuleVersion>(`${ruleKey(id)}/publish`, {
    method: "POST",
    body: { reason },
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

export function saveTemplate(key: string, body: TemplateBody) {
  return request<ConversationTemplate>(templateKey(key), {
    method: "PUT",
    body,
  });
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
