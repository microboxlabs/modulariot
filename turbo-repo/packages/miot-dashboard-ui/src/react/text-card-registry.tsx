"use client";

import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import {
  createTemplateEngine,
  createTemplateContext,
  parseTemplateRow,
} from "../templates";
import { useDashboardFilters } from "./filter-context";
import { useOptionalPlannerContext } from "./planner-results";
import { TextCard } from "./text-card";
import type { WidgetComponentProps } from "./widget-renderer";

export interface TextCardRegistryOptions {
  defaultText: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  /** Isolated engine; pass a host-owned engine to supply custom helpers. */
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}

function isDataProvider(
  entry: unknown,
): entry is { key: string; value: string } {
  return (
    !!entry &&
    typeof entry === "object" &&
    "key" in entry &&
    typeof entry.key === "string" &&
    "value" in entry &&
    typeof entry.value === "string"
  );
}

/** First built-in catalog entry: static or saved/planner-query text cards. */
export function createTextCardRegistry(
  options: Readonly<TextCardRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredTextCard({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
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
    const text =
      typeof config.text === "string" ? config.text : options.defaultText;
    const compiled = useMemo(
      () => engine.compileTemplates([{ id: "text", template: text }]),
      [text],
    );
    const row = mode === "planner" ? result?.rows[0] : staticRow;
    const providers = Array.isArray(config.dataProvider)
      ? config.dataProvider.filter(isDataProvider)
      : [];
    const resolved = engine.resolveTemplate(
      compiled,
      "text",
      createTemplateContext({
        row,
        filters: activeFilters,
        dataProvider: providers,
      }),
      text,
    );
    if (mode !== "static" && mode !== "planner")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    const pendingDeclaration = mode === "planner" && !result && definitions.some(
      (definition) => definition.variableName === config.plannerVariableName,
    );
    if (pendingDeclaration || result?.loading)
      return <output>{options.loadingLabel}</output>;
    if (mode === "planner" && (!result || result.error))
      return <p role="alert">{options.errorLabel}</p>;
    if (result?.loading) return <output>{options.loadingLabel}</output>;
    return (
      <TextCard
        text={resolved}
        italic={typeof config.italic === "boolean" ? config.italic : true}
        align={
          config.align === "center" || config.align === "right"
            ? config.align
            : "left"
        }
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "text_card", hasChildren: false, hasSettings: false },
      Component: RegisteredTextCard,
      getLayoutDefaults: () => ({ minW: 4, minH: 1 }),
    },
  ]);
}
