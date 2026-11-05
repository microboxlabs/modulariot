"use client";

import { Badge, Button } from "flowbite-react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ShowNotification } from "@/features/notifications/notification";
import { isPrototypeApiDisabled } from "./map-view/prototype/prototype-api-guard";
import {
  isCaseKey,
  resumeTreatment,
} from "@/features/symptoms/control-tower/control-tower-api";
import {
  formatLeft,
  secondsLeft,
  type IgnoredInfo,
} from "@/features/symptoms/model/ignore-hold";

/** "Ignorado · quedan 4 min" or "… hasta que termine el viaje". */
export function ignoredLabel(info: IgnoredInfo, dict: I18nRecord): string {
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;
  const left = secondsLeft(info);
  return left === null
    ? `${t("ignored_badge")} · ${t("ignore_until_trip_end")}`
    : `${t("ignored_badge")} · ${t("ignored_left")} ${formatLeft(left)}`;
}

/**
 * A held case's time left and its "Reanudar" button, which ends the hold now:
 * the case is checked as when the time runs out. The symptom lists and the
 * treatment page refresh.
 */
export default function IgnoredHoldCell({
  info,
  dict,
}: Readonly<{ info: IgnoredInfo; dict: I18nRecord }>) {
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);

  const resume = async () => {
    if (busy || isPrototypeApiDisabled()) return;
    setBusy(true);
    try {
      const resumed = await resumeTreatment(info.treatment_id);
      await mutate(
        (key) =>
          (typeof key === "string" &&
            (key.startsWith("/app/api/symptoms") ||
              key.startsWith("/app/api/treatments"))) ||
          (resumed?.symptomId != null && isCaseKey(resumed.symptomId, key))
      );
      ShowNotification({ type: "success", message: t("resume_done") });
    } catch {
      ShowNotification({ type: "error", message: t("resume_error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge color="gray" className="w-fit">
        {ignoredLabel(info, dict)}
      </Badge>
      <Button
        size="xs"
        color="light"
        className="!text-xs"
        disabled={busy || isPrototypeApiDisabled()}
        onClick={resume}
      >
        {t("resume")}
      </Button>
    </div>
  );
}
