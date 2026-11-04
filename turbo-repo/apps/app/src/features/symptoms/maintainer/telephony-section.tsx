"use client";

import { useState } from "react";
import { Label, Select } from "flowbite-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ControlTowerError } from "../control-tower/control-tower-api";
import {
  saveTelephony,
  useTelephony,
  type TelephonyProvider,
  type TelephonySetup,
} from "../control-tower/telephony-api";
import { MUTED } from "./ui/card";

const AUTO = "AUTO";

/** The line "Llamar a" uses: its name and provider, or the phone's dialer. */
export function activeLineLabel(setup: TelephonySetup, d: I18nRecord): string {
  if (!setup.active) return tr("telephonyNone", d);
  const provider =
    setup.active.provider === "TELNYX" ? "Telnyx" : "Teams Phone";
  return `${setup.active.name} · ${provider}`;
}

/**
 * Which telephony connection the treatment's calls use. Saved on change; the
 * connections themselves are set up in Conexiones.
 */
export default function TelephonySection({ d }: Readonly<{ d: I18nRecord }>) {
  const { lang } = useParams<{ lang: string }>();
  const { data: setup, error } = useTelephony();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (error || !setup) {
    return (
      <p className={`text-sm ${MUTED}`}>
        {error ? tr("telephonyLoadFailed", d) : tr("loading", d)}
      </p>
    );
  }

  const choose = async (value: string) => {
    setBusy(true);
    setFailed(null);
    try {
      await saveTelephony(value === AUTO ? null : (value as TelephonyProvider));
    } catch (e) {
      setFailed(
        e instanceof ControlTowerError && e.status === 403
          ? tr("teamOwnersOnly", d)
          : tr("telephonySaveFailed", d)
      );
    } finally {
      setBusy(false);
    }
  };

  const has = (p: TelephonyProvider) =>
    setup.lines.some((l) => l.provider === p);

  return (
    <div className="flex flex-col gap-1 border-t border-gray-200 pt-4 dark:border-gray-700">
      <Label htmlFor="tower-telephony">{tr("telephonyTitle", d)}</Label>
      <Select
        id="tower-telephony"
        value={setup.preferred ?? AUTO}
        disabled={busy}
        onChange={(e) => void choose(e.target.value)}
      >
        <option value={AUTO}>{tr("telephonyAuto", d)}</option>
        <option value="TELNYX" disabled={!has("TELNYX")}>
          Telnyx
        </option>
        <option value="TEAMS_PHONE" disabled={!has("TEAMS_PHONE")}>
          Teams Phone
        </option>
      </Select>
      <p className={`text-xs ${MUTED}`}>
        {tr("telephonyActive", d)}: {activeLineLabel(setup, d)}
      </p>
      {setup.lines
        .filter((l) => !l.ready)
        .map((l) => (
          <p
            key={l.connectionId}
            className="text-xs text-amber-700 dark:text-amber-400"
          >
            {tr("telephonyNotReady", d, { name: l.name })}
          </p>
        ))}
      <Link
        href={`/${lang}/users/settings/connections`}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {tr("telephonyConnections", d)}
      </Link>
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {failed}
        </p>
      )}
    </div>
  );
}
