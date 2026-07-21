"use client";

import { useCallback, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type {
  AsyncJob,
  JobListFilters,
  JobsOverview,
  NotificationRule,
  NotificationRuleUpsert,
} from "./integration-job.types";
import {
  deleteNotificationRule,
  fetchJob,
  fetchJobs,
  fetchJobsOverview,
  fetchNotificationRules,
  retryJob,
  upsertNotificationRule,
} from "./integration-jobs-data-service";

const JOBS_KEY = "org-integration-jobs";
const OVERVIEW_KEY = "org-integration-jobs-overview";
const JOB_KEY = "org-integration-job";
const RULES_KEY = "org-integration-notification-rules";

export function useIntegrationJobs(orgSlug: string | null, filters: JobListFilters = {}) {
  const { data, error, isLoading, mutate } = useSWR<AsyncJob[], Error>(
    orgSlug
      ? [JOBS_KEY, orgSlug, filters.state ?? "", filters.jobType ?? "", filters.chainKey ?? "", filters.limit ?? 100]
      : null,
    () => fetchJobs(orgSlug as string, filters),
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  );
  return { jobs: data ?? [], isLoading, error, refresh: mutate };
}

export function useIntegrationJobsOverview(orgSlug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<JobsOverview, Error>(
    orgSlug ? [OVERVIEW_KEY, orgSlug] : null,
    () => fetchJobsOverview(orgSlug as string),
    { revalidateOnFocus: false, dedupingInterval: 10_000 },
  );
  return { overview: data ?? null, isLoading, error, refresh: mutate };
}

export function useIntegrationJob(orgSlug: string | null, jobId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<AsyncJob, Error>(
    orgSlug && jobId ? [JOB_KEY, orgSlug, jobId] : null,
    () => fetchJob(orgSlug as string, jobId as string),
    { revalidateOnFocus: false },
  );
  return { job: data ?? null, isLoading, error, refresh: mutate };
}

/** Chain members for the detail panel (only fetches when the job has a chain). */
export function useIntegrationJobChain(orgSlug: string | null, chainKey: string | null) {
  const { data } = useSWR<AsyncJob[], Error>(
    orgSlug && chainKey ? [JOBS_KEY, orgSlug, "chain", chainKey] : null,
    () => fetchJobs(orgSlug as string, { chainKey: chainKey as string, limit: 50 }),
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  );
  return { chain: data ?? [] };
}

export function useRetryJob(orgSlug: string | null) {
  const { mutate } = useSWRConfig();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<Error | null>(null);

  const retry = useCallback(
    async (jobId: string) => {
      if (!orgSlug) return null;
      setRetrying(jobId);
      setRetryError(null);
      try {
        const updated = await retryJob(orgSlug, jobId);
        await Promise.all([
          mutate((key) => Array.isArray(key) && key[0] === JOBS_KEY && key[1] === orgSlug),
          mutate([OVERVIEW_KEY, orgSlug]),
          mutate([JOB_KEY, orgSlug, jobId]),
        ]);
        return updated;
      } catch (error) {
        setRetryError(error as Error);
        return null;
      } finally {
        setRetrying(null);
      }
    },
    [orgSlug, mutate],
  );

  return { retry, retrying, retryError };
}

export function useNotificationRules(orgSlug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<NotificationRule[], Error>(
    orgSlug ? [RULES_KEY, orgSlug] : null,
    () => fetchNotificationRules(orgSlug as string),
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  );
  return { rules: data ?? [], isLoading, error, refresh: mutate };
}

/** Save/delete a notification rule, revalidating the rules list on success. */
export function useSaveNotificationRule(orgSlug: string | null) {
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const run = useCallback(
    async (jobType: string, action: () => Promise<unknown>) => {
      if (!orgSlug) return false;
      setSaving(jobType);
      setSaveError(null);
      try {
        await action();
        await mutate([RULES_KEY, orgSlug]);
        return true;
      } catch (error) {
        setSaveError(error as Error);
        return false;
      } finally {
        setSaving(null);
      }
    },
    [orgSlug, mutate],
  );

  const save = useCallback(
    (jobType: string, rule: NotificationRuleUpsert) =>
      run(jobType, () => upsertNotificationRule(orgSlug as string, jobType, rule)),
    [orgSlug, run],
  );

  const remove = useCallback(
    (jobType: string) => run(jobType, () => deleteNotificationRule(orgSlug as string, jobType)),
    [orgSlug, run],
  );

  return { save, remove, saving, saveError, clearError: () => setSaveError(null) };
}

/** Revalidates every jobs-related SWR key for the org (used on live events). */
export function useRevalidateJobs(orgSlug: string | null) {
  const { mutate } = useSWRConfig();
  return useCallback(() => {
    if (!orgSlug) return;
    void mutate(
      (key) =>
        Array.isArray(key) &&
        (key[0] === JOBS_KEY || key[0] === OVERVIEW_KEY || key[0] === JOB_KEY) &&
        key[1] === orgSlug,
    );
  }, [orgSlug, mutate]);
}
