"use client";

import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { createTemplateEngine } from "../templates";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
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

/** First built-in catalog entry: static or saved/planner-query text cards. */
export function createTextCardRegistry(
  options: Readonly<TextCardRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredTextCard({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const text =
      typeof config.text === "string" ? config.text : options.defaultText;
    const fields = useMemo(() => ({ text }), [text]);
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    if (status === "unsupported")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    if (status === "loading") return <output>{options.loadingLabel}</output>;
    if (status === "error") return <p role="alert">{options.errorLabel}</p>;
    return (
      <TextCard
        text={resolved.text ?? text}
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
