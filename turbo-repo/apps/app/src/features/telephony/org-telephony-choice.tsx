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
import TelephonyUsage, { type OwnLine } from "./telephony-usage";

const MUTED = "text-gray-500 dark:text-gray-400";
const UNSET = "";

/** How a line reads in the selector. */
export function lineLabel(line: TelephonyLine, d: I18nRecord): string {
  if (line.provider === "TEAMS_PHONE") {
    return line.ready
      ? tr("teams", d, { name: line.name })
      : tr("notTested", d, { name: line.name });
  }
  return line.managed
    ? tr("platform", d)
    : tr("ownTelnyx", d, { name: line.name });
}

function inUse(setup: TelephonySetup, d: I18nRecord): string {
  return setup.active
    ? tr("inUse", d, { line: lineLabel(setup.active, d) })
    : tr("inUseNone", d);
}

/** The organization's own line in use, or null on the platform's line or none. */
export function ownLineOf(setup: TelephonySetup): OwnLine | null {
  const active = setup.active;
  if (!active || active.managed) return null;
  return active.provider;
}

/**
 * Settings › Síntomas › Telefonía: the platform's Telnyx line or the
 * organization's own Teams Phone or Telnyx connection. Saved on change through
 * the Control Tower telephony API, which creates the settings row when the
 * organization has none. Without telephony lines, or when the API fails, it says so.
 */
export function OrgTelephonyChoice({
  dict,
}: Readonly<{
  /** `pages.userSettings.telephony.choice`. */
  dict: I18nRecord;
}>) {
  const { data: setup, error, isLoading } = useTelephony();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (isLoading) {
    return (
      <p role="status" className={`text-sm ${MUTED}`}>
        {tr("loading", dict)}
      </p>
    );
  }
  if (error || !setup || setup.lines.length === 0) {
    return (
      <p
        role={error ? "alert" : "status"}
        className={`text-sm ${error ? "text-red-600 dark:text-red-400" : MUTED}`}
      >
        {error ? tr("loadFailed", dict) : tr("noLines", dict)}
      </p>
    );
  }

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
          ? tr("forbidden", dict)
          : tr("saveFailed", dict)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex max-w-3xl flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <Label
        htmlFor="org-telephony"
        className="flex items-center gap-2 font-semibold"
      >
        <HiOutlinePhone className="h-4 w-4" />
        {tr("title", dict)}
      </Label>
      <p id="org-telephony-hint" className={`text-xs ${MUTED}`}>
        {tr("hint", dict)}
      </p>
      <Select
        id="org-telephony"
        aria-describedby="org-telephony-hint"
        aria-busy={busy}
        sizing="sm"
        className="mt-1 max-w-md"
        value={setup.preferred ?? UNSET}
        disabled={busy}
        onChange={(e) => void choose(e.target.value)}
      >
        {setup.preferred === null && (
          <option value={UNSET} disabled>
            {tr("unset", dict)}
          </option>
        )}
        <option value="TELNYX" disabled={!telnyx}>
          {telnyx ? lineLabel(telnyx, dict) : tr("platform", dict)}
        </option>
        {setup.preferred === "TEAMS_PHONE" && teams.length === 0 && (
          <option value="TEAMS_PHONE" disabled>
            {tr("teamsUnavailable", dict)}
          </option>
        )}
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
          {tr("unsetHint", dict)}
        </p>
      )}
      {setup.lines
        .filter((l) => !l.ready)
        .map((l) => (
          <p
            key={l.connectionId}
            className="text-xs text-amber-700 dark:text-amber-400"
          >
            {tr("notReady", dict, { name: l.name })}
          </p>
        ))}
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {failed}
        </p>
      )}
    </section>
  );
}

/**
 * Settings › Síntomas › Uso: the organization's month on the platform's line,
 * with a notice when its own Teams Phone or Telnyx line is the one in use.
 */
export function OrgTelephonyUsage({
  dict,
  orgSlug,
  lang,
}: Readonly<{
  /** `pages.userSettings.telephony.usage`. */
  dict: I18nRecord;
  orgSlug: string | null;
  lang: string;
}>) {
  const { data: setup } = useTelephony(orgSlug !== null);
  return (
    <TelephonyUsage
      orgSlug={orgSlug}
      lang={lang}
      d={dict}
      ownLine={setup ? ownLineOf(setup) : null}
    />
  );
}
