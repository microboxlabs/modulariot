"use client";

/**
 * Selectables, read from and written to the modulith core selectables API
 * (`/api/v1/orgs/{org}/selectables`). The organization gets the default lists
 * the first time it asks; writes need an organization owner.
 *
 * Writes show at once: the cached list changes before the request goes out
 * and is then replaced by what the API returns, without re-fetching the whole
 * list. A refused write rolls the cache back and shows a notification.
 */

import { useCallback } from "react";
import { mutate } from "swr";
import { ShowNotification } from "@/features/notifications/notification";
import {
  deleteSelectable,
  replaceSelectable,
  resetSelectables,
  selectablesKey,
  useApiSelectables,
  type SelectableWrite,
} from "./selectables-api";
import type { Selectable } from "./types";

function upsert(
  list: Selectable[] | undefined,
  next: Selectable
): Selectable[] {
  const current = list ?? [];
  if (current.some((s) => s.key === next.key)) {
    return current.map((s) => (s.key === next.key ? next : s));
  }
  return [...current, next];
}

function without(list: Selectable[] | undefined, key: string): Selectable[] {
  return (list ?? []).filter((s) => s.key !== key);
}

function hasLabel(option: Selectable["options"][number]): boolean {
  return Object.values(option.label).some((text) => text.trim());
}

export function toWrite(s: Selectable): SelectableWrite {
  return {
    name: s.name,
    description: s.description,
    mode: s.mode,
    settings: s.settings,
    groups: s.groups,
    source: s.source,
    // A dynamic list fetches its options, and a row left blank is not an option.
    options: s.source.kind === "STATIC" ? s.options.filter(hasLabel) : [],
  };
}

/** `failed` is the notification text when the API gives no reason. */
export function useSelectables(failed: string) {
  const { data, isLoading } = useApiSelectables();

  const notify = useCallback(
    (error: unknown) =>
      ShowNotification({
        type: "error",
        message: error instanceof Error ? error.message : failed,
      }),
    [failed]
  );

  /** Creates or replaces a whole list. Resolves to whether the API took it. */
  const save = useCallback(
    async (next: Selectable) => {
      const write = async (current: Selectable[] | undefined) =>
        upsert(current, await replaceSelectable(next.key, toWrite(next)));
      try {
        await mutate<Selectable[]>(selectablesKey, write, {
          optimisticData: (current) => upsert(current, next),
          rollbackOnError: true,
          revalidate: false,
        });
        return true;
      } catch (error) {
        notify(error);
        return false;
      }
    },
    [notify]
  );

  const remove = useCallback(
    async (key: string) => {
      const write = async (current: Selectable[] | undefined) => {
        await deleteSelectable(key);
        return without(current, key);
      };
      try {
        await mutate<Selectable[]>(selectablesKey, write, {
          optimisticData: (current) => without(current, key),
          rollbackOnError: true,
          revalidate: false,
        });
        return true;
      } catch (error) {
        notify(error);
        return false;
      }
    },
    [notify]
  );

  const resetToDefaults = useCallback(async () => {
    try {
      await mutate<Selectable[]>(selectablesKey, resetSelectables(), {
        revalidate: false,
      });
      return true;
    } catch (error) {
      notify(error);
      return false;
    }
  }, [notify]);

  return {
    selectables: data ?? [],
    hydrated: !isLoading,
    save,
    remove,
    resetToDefaults,
  };
}
