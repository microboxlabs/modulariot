"use client";

/**
 * Which selectable backs which form field, stored by the modulith Control
 * Tower API (`/selectables/bindings`). A field with no binding uses the
 * selectable whose id equals the field key, which is how the defaults
 * (`who_to_call`, `call_tags`, ...) show up pre-wired.
 */

import { useCallback } from "react";
import { mutate } from "swr";
import { ShowNotification } from "@/features/notifications/notification";
import {
  bindingsKey,
  updateSelectableBindings,
  useSelectableBindings,
} from "@/features/symptoms/control-tower/control-tower-api";

/** Returns the selectable id bound to `fieldKey` (falls back to `fieldKey`) and a setter. */
export function useFieldSelectableBinding(
  fieldKey: string
): readonly [string, (selectableId: string) => void] {
  const { data } = useSelectableBindings();

  const setBoundId = useCallback(
    (selectableId: string) => {
      updateSelectableBindings({ [fieldKey]: selectableId })
        .catch((error: unknown) =>
          ShowNotification({
            type: "error",
            message: error instanceof Error ? error.message : "No se pudo guardar",
          })
        )
        .finally(() => mutate(bindingsKey));
    },
    [fieldKey]
  );

  return [data?.[fieldKey] ?? fieldKey, setBoundId] as const;
}
