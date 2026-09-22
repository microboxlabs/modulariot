"use client";

/**
 * Selectables, read from and written to the modulith Control Tower API
 * (`/selectables`). The organization gets the default lists the first time it
 * asks; writes need an organization owner, and a refused write surfaces as a
 * notification. Same hook shape the settings page and the treatment forms
 * already use.
 */

import { useCallback } from "react";
import { mutate } from "swr";
import { ShowNotification } from "@/features/notifications/notification";
import {
  deleteSelectable,
  replaceSelectable,
  resetSelectables,
  selectablesKey,
  type TowerSelectable,
  useTowerSelectables,
} from "@/features/symptoms/control-tower/control-tower-api";
import type { Selectable } from "./types";

export function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function fromApi(s: TowerSelectable): Selectable {
  return {
    id: s.key,
    name: s.name,
    description: s.description ?? "",
    mode: s.mode === "MULTIPLE" ? "multiple" : "single",
    options: s.options.map((o) => ({ id: o.id, name: o.name, description: o.description ?? "" })),
  };
}

function toApi(s: Selectable): Omit<TowerSelectable, "key"> {
  return {
    name: s.name,
    description: s.description,
    mode: s.mode === "multiple" ? "MULTIPLE" : "SINGLE",
    // A blank row left in the editor is not an option.
    options: s.options.filter((o) => o.name.trim()).map((o) => ({ ...o, name: o.name.trim() })),
  };
}

async function run(write: () => Promise<unknown>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (error) {
    ShowNotification({
      type: "error",
      message: error instanceof Error ? error.message : "No se pudo guardar",
    });
    return false;
  } finally {
    await mutate(selectablesKey);
  }
}

export function useSelectables() {
  const { data, isLoading } = useTowerSelectables();
  const selectables = (data ?? []).map(fromApi);

  /** Creates or replaces a whole selectable (the editor modal saves once, on Save). */
  const save = useCallback((next: Selectable) => run(() => replaceSelectable(next.id, toApi(next))), []);

  const duplicate = useCallback(
    (id: string) => {
      const src = selectables.find((s) => s.id === id);
      if (!src) return Promise.resolve(false);
      const copy: Selectable = {
        ...src,
        id: makeId("sel"),
        name: `${src.name} (copia)`,
        options: src.options.map((o) => ({ ...o, id: makeId("opt") })),
      };
      return run(() => replaceSelectable(copy.id, toApi(copy)));
    },
    [selectables]
  );

  const remove = useCallback((id: string) => run(() => deleteSelectable(id)), []);

  const resetToDefaults = useCallback(() => run(() => resetSelectables()), []);

  return {
    selectables,
    hydrated: !isLoading,
    save,
    duplicate,
    remove,
    resetToDefaults,
  };
}
