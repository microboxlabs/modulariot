"use client";
import { useMemo } from "react";
import { createWidgetRegistry } from "@microboxlabs/miot-dashboard-ui/core";
import {
  createTextCardRegistry,
  createPercentageValueRegistry,
  createCircularStatRegistry,
  createProgressStatRegistry,
  WidgetRenderer,
} from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { useOptionalDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import type { DashletComponentProps } from "../types";
/** The server host supplies query results, filters and permissions through shared providers. */
export function PortableScalarWidget({
  widget,
}: Readonly<Pick<DashletComponentProps, "widget">>) {
  const { dictionary } = useOptionalDashboard();
  const registry = useMemo(() => {
    const labels = {
      loadingLabel: tr("dashboard.portableWidgets.loading", dictionary),
      errorLabel: tr("dashboard.portableWidgets.error", dictionary),
      unsupportedDataLabel: tr(
        "dashboard.portableWidgets.unsupported",
        dictionary
      ),
    };
    if (widget.componentId === "text_card")
      return createTextCardRegistry({
        ...labels,
        defaultText: tr("dashboard.portableWidgets.text", dictionary),
      });
    if (widget.componentId === "percentage_value")
      return createPercentageValueRegistry({
        ...labels,
        defaultTitle: tr("dashboard.portableWidgets.progress", dictionary),
      });
    if (widget.componentId === "stat_progress")
      return createProgressStatRegistry({
        ...labels,
        defaultTitle: tr("dashboard.portableWidgets.progress", dictionary),
        defaultUnit: "%",
      });
    if (widget.componentId === "stat_circular")
      return createCircularStatRegistry({
        ...labels,
        defaultTitle: tr("dashboard.portableWidgets.storage", dictionary),
        defaultUnit: tr("dashboard.portableWidgets.unit", dictionary),
        formatTotal: (max, unit) =>
          `${tr("dashboard.widgetOf", dictionary)} ${max} ${unit}`,
      });
    return createWidgetRegistry([]);
  }, [dictionary, widget.componentId]);
  return (
    <WidgetRenderer
      registry={registry}
      widget={widget}
      unknownWidgetLabel={tr("dashboard.portableWidgets.unknown", dictionary)}
    />
  );
}
