"use client";

import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import type {
  DataSourceListItem,
  CreateDataSourceInput,
  UpdateDataSourceInput,
} from "../types";
import { useState } from "react";

export function useDataSources(orgId: string | undefined) {
  const [actionLoading, setActionLoading] = useState(false);

  const {
    data: dataSources,
    error,
    isLoading,
    mutate,
  } = useSWR<DataSourceListItem[]>(
    orgId ? `/app/api/data-sources?orgId=${orgId}` : null,
    fetcher
  );

  async function create(input: CreateDataSourceInput) {
    setActionLoading(true);
    try {
      const created = await fetcher<DataSourceListItem>(
        `/app/api/data-sources?orgId=${orgId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      await mutate();
      return created;
    } finally {
      setActionLoading(false);
    }
  }

  async function update(id: string, input: UpdateDataSourceInput) {
    setActionLoading(true);
    try {
      const updated = await fetcher<DataSourceListItem>(
        `/app/api/data-sources/${id}?orgId=${orgId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      await mutate();
      return updated;
    } finally {
      setActionLoading(false);
    }
  }

  async function remove(id: string) {
    setActionLoading(true);
    try {
      await fetcher(`/app/api/data-sources/${id}?orgId=${orgId}`, {
        method: "DELETE",
      });
      await mutate();
    } finally {
      setActionLoading(false);
    }
  }

  async function testConnection(id: string) {
    setActionLoading(true);
    try {
      const result = await fetcher<{
        success: boolean;
        testedAt: string;
        error?: string;
      }>(`/app/api/data-sources/${id}/test?orgId=${orgId}`, {
        method: "POST",
      });
      await mutate();
      return result;
    } finally {
      setActionLoading(false);
    }
  }

  return {
    dataSources: dataSources ?? [],
    isLoading,
    error,
    actionLoading,
    create,
    update,
    remove,
    testConnection,
  };
}
