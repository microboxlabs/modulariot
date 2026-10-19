"use client";
import { useMemo } from "react";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import {
  createTemplateContext,
  parseTemplateRow,
  type createTemplateEngine,
} from "../templates";
import { useDashboardFilters } from "./filter-context";
import { useOptionalPlannerContext } from "./planner-results";
function isProvider(entry: unknown): entry is { key: string; value: string } {
  return (
    !!entry &&
    typeof entry === "object" &&
    "key" in entry &&
    typeof entry.key === "string" &&
    "value" in entry &&
    typeof entry.value === "string"
  );
}
/** Shared static/saved-query binding. Transport and authorization remain in providers. */
export function useWidgetTemplateFields(
  config: Widget["config"],
  fields: Readonly<Record<string, string>>,
  engine: ReturnType<typeof createTemplateEngine>,
) {
  const mode = config.dataMode ?? "static";
  const { results, definitions } = useOptionalPlannerContext();
  const { activeFilters } = useDashboardFilters();
  const result =
    mode === "planner" && typeof config.plannerVariableName === "string"
      ? results.get(config.plannerVariableName)
      : undefined;
  const staticRow = useMemo(
    () =>
      parseTemplateRow(
        typeof config.staticData === "string" ? config.staticData : undefined,
      ),
    [config.staticData],
  );
  const compiled = useMemo(
    () =>
      engine.compileTemplates(
        Object.entries(fields).map(([id, template]) => ({ id, template })),
      ),
    [engine, fields],
  );
  let status: "ready" | "loading" | "error" | "unsupported" = "ready";
  if (mode !== "static" && mode !== "planner") status = "unsupported";
  else if (mode === "planner") {
    if (
      result?.loading ||
      (!result &&
        definitions.some((d) => d.variableName === config.plannerVariableName))
    )
      status = "loading";
    else if (!result || result.error) status = "error";
  }
  const context = createTemplateContext({
    row: mode === "planner" ? result?.rows[0] : staticRow,
    filters: activeFilters,
    dataProvider: Array.isArray(config.dataProvider)
      ? config.dataProvider.filter(isProvider)
      : [],
  });
  const resolved =
    status === "ready"
      ? Object.fromEntries(
          Object.entries(fields).map(([id, fallback]) => [
            id,
            engine.resolveTemplate(compiled, id, context, fallback),
          ]),
        )
      : {};
  return { status, resolved };
}
