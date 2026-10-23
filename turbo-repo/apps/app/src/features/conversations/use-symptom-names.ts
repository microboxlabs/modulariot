"use client";

import { useCallback, useMemo } from "react";
import { useSymptomDefinitions } from "@/features/symptoms/maintainer/maintainer-api";

/** The organization's symptom names by key, for trigger summaries. */
export function useSymptomNames(): (key: string) => string | undefined {
  const { data } = useSymptomDefinitions();
  const names = useMemo(
    () =>
      new Map((data ?? []).map((s) => [s.definition.key, s.definition.name])),
    [data]
  );
  return useCallback((key: string) => names.get(key), [names]);
}
