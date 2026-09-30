"use client";
import { useState } from "react";
import { Button } from "flowbite-react";
import { DashboardGeneralSettings } from "@microboxlabs/miot-dashboard-ui/react";
import { useDashboard } from "../context/dashboard-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
export function ServerDashboardSettings({
  editable,
  dictionary,
}: Readonly<{ editable: boolean; dictionary: I18nRecord }>) {
  const [open, setOpen] = useState(false);
  const { dashboardName, refreshInterval, order, setGeneralSettings } =
    useDashboard();
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
