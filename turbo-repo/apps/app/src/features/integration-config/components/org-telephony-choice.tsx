"use client";

import { useState } from "react";
import { Label, Select } from "flowbite-react";
import { HiOutlinePhone } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import {
  saveTelephony,
  useTelephony,
  type TelephonyLine,
  type TelephonyProvider,
  type TelephonySetup,
} from "@/features/symptoms/control-tower/telephony-api";
import TelephonyUsage, {
  type OwnLine,
} from "@/features/telephony/telephony-usage";

const MUTED = "text-gray-500 dark:text-gray-400";
const UNSET = "";

/** How a line reads in the selector. */
export function lineLabel(line: TelephonyLine, d: I18nRecord): string {
  if (line.provider === "TEAMS_PHONE") {
    return line.ready
      ? tr("telephonyChoice.teams", d, { name: line.name })
      : tr("telephonyChoice.notTested", d, { name: line.name });
  }
  return line.managed
    ? tr("telephonyChoice.platform", d)
    : tr("telephonyChoice.ownTelnyx", d, { name: line.name });
}

function inUse(setup: TelephonySetup, d: I18nRecord): string {
  return setup.active
    ? tr("telephonyChoice.inUse", d, { line: lineLabel(setup.active, d) })
    : tr("telephonyChoice.inUseNone", d);
}

/** The organization's own line in use, or null on the platform's line or none. */
export function ownLineOf(setup: TelephonySetup): OwnLine | null {
  const active = setup.active;
  if (!active || active.managed) return null;
  return active.provider;
}

/**
 * The organization's telephony: the platform's Telnyx line or its own Teams
 * Phone connection, then its month's usage of the platform line. Saved on
 * change through the Control Tower telephony API, which creates the settings
 * row when the organization has none. Renders nothing when the organization
 * has no telephony, or the API is unavailable.
 */
export function OrgTelephonyChoice({
  dict,
  usageDict,
  orgSlug,
  lang,
}: Readonly<{
  dict: I18nRecord;
  /** `pages.userSettings.telephony.usage`. */
  usageDict: I18nRecord;
  orgSlug: string | null;
  lang: string;
}>) {
  const { data: setup, error } = useTelephony(orgSlug !== null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (error || !setup || setup.lines.length === 0) return null;

  const telnyx = setup.lines.find((l) => l.provider === "TELNYX");
  const teams = setup.lines.filter((l) => l.provider === "TEAMS_PHONE");

  const choose = async (value: string) => {
    if (value === UNSET) return;
    setBusy(true);
    setFailed(null);
    try {
      await saveTelephony(value as TelephonyProvider);
    } catch (e) {
      setFailed(
        e instanceof ControlTowerError && e.status === 403
          ? tr("telephonyChoice.forbidden", dict)
          : tr("telephonyChoice.saveFailed", dict)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex max-w-3xl flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <Label
          htmlFor="org-telephony"
          className="flex items-center gap-2 font-semibold"
        >
          <HiOutlinePhone className="h-4 w-4" />
          {tr("telephonyChoice.title", dict)}
        </Label>
        <p className={`text-xs ${MUTED}`}>{tr("telephonyChoice.hint", dict)}</p>
        <Select
          id="org-telephony"
          sizing="sm"
          className="mt-1 max-w-md"
          value={setup.preferred ?? UNSET}
          disabled={busy}
          onChange={(e) => void choose(e.target.value)}
        >
          {setup.preferred === null && (
            <option value={UNSET} disabled>
              {tr("telephonyChoice.unset", dict)}
            </option>
          )}
          <option value="TELNYX" disabled={!telnyx}>
            {telnyx
              ? lineLabel(telnyx, dict)
              : tr("telephonyChoice.platform", dict)}
          </option>
          {teams.map((line) => (
            <option
              key={line.connectionId}
              value="TEAMS_PHONE"
              disabled={!line.ready && setup.preferred !== "TEAMS_PHONE"}
            >
              {lineLabel(line, dict)}
            </option>
          ))}
        </Select>
        <p className={`text-xs ${MUTED}`}>{inUse(setup, dict)}</p>
        {setup.preferred === null && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {tr("telephonyChoice.unsetHint", dict)}
          </p>
        )}
        {setup.lines
          .filter((l) => !l.ready)
          .map((l) => (
            <p
              key={l.connectionId}
              className="text-xs text-amber-700 dark:text-amber-400"
            >
              {tr("telephonyChoice.notReady", dict, { name: l.name })}
            </p>
          ))}
        {failed && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {failed}
          </p>
        )}
      </section>
      <TelephonyUsage
        orgSlug={orgSlug}
        lang={lang}
        d={usageDict}
        ownLine={ownLineOf(setup)}
      />
    </div>
  );
}
