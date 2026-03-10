"use client";

import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import type {
  DataSourceListItem,
  DataSourceFormData,
  UpdateDataSourceInput,
} from "../types";
import { useState } from "react";

export function useDataSources(siteId: string | undefined) {
  const [actionLoading, setActionLoading] = useState(false);

  const {
    data: dataSources,
    error,
    isLoading,
    mutate,
  } = useSWR<DataSourceListItem[]>(
    siteId ? `/app/api/data-sources?siteId=${siteId}` : null,
    fetcher
  );

  async function create(input: DataSourceFormData) {
    setActionLoading(true);
    try {
      const created = await fetcher<DataSourceListItem>(
        `/app/api/data-sources?siteId=${siteId}`,
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
        `/app/api/data-sources/${encodeURIComponent(id)}?siteId=${siteId}`,
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
      await fetcher(`/app/api/data-sources/${encodeURIComponent(id)}?siteId=${siteId}`, {
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
      }>(`/app/api/data-sources/${encodeURIComponent(id)}/test?siteId=${siteId}`, {
        method: "POST",
      });
      await mutate();
      return result;
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setActionLoading(true);
    try {
      await fetcher<DataSourceListItem>(
        `/app/api/data-sources/${encodeURIComponent(id)}?siteId=${siteId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        }
      );
      await mutate();
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
    toggleActive,
    refetch: mutate,
  };
}
