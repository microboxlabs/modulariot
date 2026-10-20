"use client";

import { useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { ApiError } from "../data/json-client";
import {
  createDataShare,
  fetchDataShares,
  fetchShareableAssets,
  fetchSharingFigures,
  fetchSharingOrgs,
  revokeDataShare,
} from "./data-sharing-api";
import type {
  CreateDataShare,
  DataShare,
  DataShareAsset,
  DataShareOrg,
  DataSharingFigures,
} from "./platform.types";

const ORGS_KEY = "platform-data-sharing-orgs";
const SHARES_KEY = "platform-data-sharing-shares";
const SUMMARY_KEY = "platform-data-sharing-summary";
const NO_FIGURES: DataSharingFigures = {
  active: 0,
  organizations: 0,
  assets: 0,
  endingSoon: 0,
};
const OPTIONS = { revalidateOnFocus: false };

/** The data shares and the organizations they connect. */
export function usePlatformDataShares() {
  const { mutate } = useSWRConfig();
  const orgsQuery = useSWR<DataShareOrg[], ApiError>(
    ORGS_KEY,
    fetchSharingOrgs,
    OPTIONS
  );
  const sharesQuery = useSWR<DataShare[], ApiError>(
    SHARES_KEY,
    fetchDataShares,
    OPTIONS
  );
  const summaryQuery = useSWR<DataSharingFigures, ApiError>(
    SUMMARY_KEY,
    fetchSharingFigures,
    OPTIONS
  );

  const orgs = useMemo(
    () =>
      new Map<string, DataShareOrg>(
        (orgsQuery.data ?? []).map((o) => [o.slug, o])
      ),
    [orgsQuery.data]
  );

  const refresh = () =>
    Promise.all([mutate(SHARES_KEY), mutate(SUMMARY_KEY)]).then(() => {});

  const create = async (draft: CreateDataShare) => {
    const share = await createDataShare(draft);
    await refresh();
    return share;
  };

  const revoke = async (id: string) => {
    await revokeDataShare(id);
    await refresh();
  };

  return {
    shares: sharesQuery.data ?? [],
    orgs,
    figures: summaryQuery.data ?? NO_FIGURES,
    isLoading: orgsQuery.isLoading || sharesQuery.isLoading,
    error: orgsQuery.error ?? sharesQuery.error ?? summaryQuery.error,
    create,
    revoke,
  };
}

const NO_ASSETS: DataShareAsset[] = [];

/** The assets an organization can share: those its client sends. Empty until one is picked. */
export function useShareableAssets(slug: string) {
  const { data, isLoading, error } = useSWR<DataShareAsset[], ApiError>(
    slug ? ["platform-data-sharing-assets", slug] : null,
    () => fetchShareableAssets(slug),
    OPTIONS
  );
  return { assets: data ?? NO_ASSETS, isLoading, error };
}
