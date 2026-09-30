"use client";
import { useState } from "react";
import { Button } from "flowbite-react";
import {
  DashboardGeneralSettings,
  DashboardFilterEditor,
} from "@microboxlabs/miot-dashboard-ui/react";
import { useDashboard } from "../context/dashboard-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
export function ServerDashboardSettings({
  editable,
  dictionary,
}: Readonly<{ editable: boolean; dictionary: I18nRecord }>) {
  const [open, setOpen] = useState(false);
  const {
    dashboardName,
    refreshInterval,
    order,
    setGeneralSettings,
    filters,
    setFilterDefinitions,
  } = useDashboard();
  const t = (key: string) => tr(`dashboard.server.settings.${key}`, dictionary);
  if (!editable) return null;
  return (
    <section className="space-y-3 border-b p-3" aria-label={t("title")}>
      <Button size="sm" color="light" onClick={() => setOpen(true)}>
        {t("title")}
      </Button>
      {open && (
        <>
          <p>{t("hint")}</p>
          <DashboardGeneralSettings
            value={{ name: dashboardName, refreshInterval, order }}
            editable={editable}
            onApply={setGeneralSettings}
            labels={{
              name: t("name"),
              refresh: t("refresh"),
              order: t("order"),
              apply: t("apply"),
              invalid: t("invalid"),
              rejected: t("rejected"),
              intervals: {
                0: t("off"),
                10: t("seconds10"),
                30: t("seconds30"),
                60: t("minute1"),
                300: t("minutes5"),
              },
            }}
          />
          <h3>{t("filters.title")}</h3>
          <p>{t("filters.hint")}</p>
          <DashboardFilterEditor
            value={filters}
            editable={editable}
            onApply={setFilterDefinitions}
            labels={{
              key: t("filters.key"),
              label: t("filters.label"),
              type: t("filters.type"),
              unique: t("filters.unique"),
              add: t("filters.add"),
              remove: t("filters.remove"),
              optionLabel: t("filters.optionLabel"),
              optionValue: t("filters.optionValue"),
              addOption: t("filters.addOption"),
              removeOption: t("filters.removeOption"),
              apply: t("filters.apply"),
              invalid: t("filters.invalid"),
              rejected: t("rejected"),
              empty: t("filters.empty"),
              types: {
                text: t("filters.text"),
                date_range: t("filters.dateRange"),
                select: t("filters.select"),
              },
            }}
          />
          <Button
            size="sm"
            color="light"
            onClick={() => {
              if (globalThis.confirm(t("discard"))) setOpen(false);
            }}
          >
            {t("close")}
          </Button>
        </>
      )}
    </section>
  );
}
