"use client";

import type {
  AsyncJob,
  JobListFilters,
  JobsOverview,
  NotificationRule,
  NotificationRuleUpsert,
} from "./integration-job.types";

/**
 * Thin client-side fetch wrappers around the Next.js proxy routes for the
 * integrations job console. Throw on non-2xx so SWR can surface the error.
 */

interface ApiErrorOptions {
  readonly status: number;
  readonly url: string;
  readonly message?: string;
}

export class JobsApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor({ status, url, message }: ApiErrorOptions) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "JobsApiError";
    this.status = status;
    this.url = url;
  }
}

const base = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations/jobs`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new JobsApiError({ status: res.status, url });
  }
  return (await res.json()) as T;
}

async function postJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    let message: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message;
    } catch {
      // non-JSON error body — fall back to the status message
    }
    throw new JobsApiError({ status: res.status, url, message });
  }
  return (await res.json()) as T;
}

export function fetchJobs(orgSlug: string, filters: JobListFilters = {}): Promise<AsyncJob[]> {
  const params = new URLSearchParams();
  if (filters.state) params.set("state", filters.state);
  if (filters.jobType) params.set("jobType", filters.jobType);
  if (filters.chainKey) params.set("chainKey", filters.chainKey);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  return getJson<AsyncJob[]>(`${base(orgSlug)}${suffix}`);
}

export function fetchJobsOverview(orgSlug: string): Promise<JobsOverview> {
  return getJson<JobsOverview>(`${base(orgSlug)}/overview`);
}

export function fetchJob(orgSlug: string, jobId: string): Promise<AsyncJob> {
  return getJson<AsyncJob>(`${base(orgSlug)}/${encodeURIComponent(jobId)}`);
}

export function retryJob(orgSlug: string, jobId: string): Promise<AsyncJob> {
  return postJson<AsyncJob>(`${base(orgSlug)}/${encodeURIComponent(jobId)}/retry`);
}

const rulesBase = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations/notification-rules`;

async function readError(res: Response, url: string): Promise<JobsApiError> {
  let message: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    message = body.error ?? body.message;
  } catch {
    // non-JSON error body — fall back to the status message
  }
  return new JobsApiError({ status: res.status, url, message });
}

export function fetchNotificationRules(orgSlug: string): Promise<NotificationRule[]> {
  return getJson<NotificationRule[]>(rulesBase(orgSlug));
}

export async function upsertNotificationRule(
  orgSlug: string,
  jobType: string,
  rule: NotificationRuleUpsert,
): Promise<NotificationRule> {
  const url = `${rulesBase(orgSlug)}/${encodeURIComponent(jobType)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
  if (!res.ok) {
    throw await readError(res, url);
  }
  return (await res.json()) as NotificationRule;
}

export async function deleteNotificationRule(orgSlug: string, jobType: string): Promise<void> {
  const url = `${rulesBase(orgSlug)}/${encodeURIComponent(jobType)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw await readError(res, url);
  }
}
