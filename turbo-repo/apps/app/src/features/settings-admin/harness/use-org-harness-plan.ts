"use client";

import useSWR from "swr";
import { ApiError, getJson, sendJson } from "../data/json-client";
import type {
  HarnessSubscription,
  OrgHarnessPlan,
  SetHarnessSubscription,
} from "./harness-plan.types";

function planUrl(orgSlug: string): string {
  return `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/harness-plan`;
}

/** An organization's seats, access and token pool, and the write that changes them. */
export function useOrgHarnessPlan(orgSlug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OrgHarnessPlan, ApiError>(
    orgSlug ? ["org-harness-plan", orgSlug] : null,
    ([, slug]: [string, string]) => getJson<OrgHarnessPlan>(planUrl(slug)),
    { revalidateOnFocus: false }
  );

  const save = async (value: SetHarnessSubscription) => {
    if (!orgSlug) throw new Error("no organization selected");
    const saved = await sendJson<HarnessSubscription>(
      "PUT",
      planUrl(orgSlug),
      value
    );
    await mutate();
    return saved;
  };

  return { data: data ?? null, isLoading, error: error ?? null, save };
}
