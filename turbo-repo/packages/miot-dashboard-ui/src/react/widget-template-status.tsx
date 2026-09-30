"use client";
import type { ReactNode } from "react";
export interface WidgetTemplateStatusLabels {
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
}
/** Loading, error and unsupported-binding states shared by template-bound widgets. */
export function templateStatusView(
  status: string,
  labels: Readonly<WidgetTemplateStatusLabels>,
): ReactNode {
  if (status === "loading") return <output>{labels.loadingLabel}</output>;
  if (status === "error") return <p role="alert">{labels.errorLabel}</p>;
  if (status === "unsupported")
    return <p role="alert">{labels.unsupportedDataLabel}</p>;
  return undefined;
}
