"use client";

import { useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import Link from "next/link";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { telephonySettingsHref } from "@/features/telephony/telephony-settings";
import { useUnsavedNavigation } from "@/features/common/hooks/use-unsaved-navigation";
import { ControlTowerError } from "../control-tower/control-tower-api";
import {
  saveTowerTeam,
  useControlTowerAccess,
  useTowerTeam,
  type TowerTeam,
} from "./maintainer-api";
import { MUTED } from "./ui/card";

/** Bounds the API accepts. */
const MAX_OPERATORS = 10_000;
const MAX_CAPACITY = 1_000_000;

/** "" → null; anything else must be a whole number in [min, max]. */
export function parseCount(raw: string, min: number, max: number) {
  const text = raw.trim();
  if (text === "") return { ok: true as const, value: null };
  if (!/^\d+$/.test(text)) return { ok: false as const };
  const value = Number(text);
  return value >= min && value <= max
    ? { ok: true as const, value }
    : { ok: false as const };
}

const text = (n: number | null) => (n == null ? "" : String(n));

/**
 * Settings › Síntomas › Equipo: the operator team used by the operator load
 * card: operators, shift length, cases a shift can handle. The form waits for
 * the saved team, so a save never starts from blanks.
 */
export default function TeamSettings({
  d,
  lang,
}: Readonly<{
  d: I18nRecord;
  lang: string;
}>) {
  const { data: team, error } = useTowerTeam(true);
  return (
    <section className="flex max-w-3xl flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="font-semibold text-gray-900 dark:text-white">
        {tr("teamTitle", d)}
      </h2>
      {team ? (
        <TeamForm team={team} d={d} />
      ) : (
        <p
          role={error ? "alert" : "status"}
          className={`text-sm ${error ? "text-red-600 dark:text-red-400" : MUTED}`}
        >
          {error ? tr("teamLoadFailed", d) : tr("loading", d)}
        </p>
      )}
      <TelephonyLink d={d} lang={lang} />
    </section>
  );
}

function TeamForm({
  team,
  d,
}: Readonly<{
  team: TowerTeam;
  d: I18nRecord;
}>) {
  const [operators, setOperators] = useState(text(team.operators));
  const [shiftHours, setShiftHours] = useState(String(team.shiftHours));
  const [capacity, setCapacity] = useState(text(team.capacityPerShift));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(() => ({
    operators: text(team.operators),
    shiftHours: String(team.shiftHours),
    capacity: text(team.capacityPerShift),
  }));
  const dirty =
    operators !== baseline.operators ||
    shiftHours !== baseline.shiftHours ||
    capacity !== baseline.capacity;
  useUnsavedNavigation(busy || dirty, tr("teamUnsaved", d));

  const ops = parseCount(operators, 0, MAX_OPERATORS);
  const hours = parseCount(shiftHours, 1, 24);
  const cap = parseCount(capacity, 0, MAX_CAPACITY);
  const valid = ops.ok && hours.ok && hours.value != null && cap.ok;

  const edit = (setValue: (v: string) => void) => (v: string) => {
    setSaved(false);
    setValue(v);
  };

  const save = async () => {
    if (!ops.ok || !hours.ok || hours.value == null || !cap.ok) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveTowerTeam({
        operators: ops.value,
        shiftHours: hours.value,
        capacityPerShift: cap.value,
      });
      setBaseline({ operators, shiftHours, capacity });
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof ControlTowerError && e.status === 403
          ? tr("teamOwnersOnly", d)
          : tr("teamSaveFailed", d)
      );
    } finally {
      setBusy(false);
    }
  };

  const field = (
    id: string,
    label: string,
    hint: string,
    value: string,
    setValue: (v: string) => void,
    ok: boolean
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <TextInput
        id={id}
        inputMode="numeric"
        className="max-w-xs"
        value={value}
        disabled={busy}
        color={ok ? undefined : "failure"}
        aria-invalid={!ok}
        aria-describedby={`${id}-hint`}
        onChange={(e) => edit(setValue)(e.target.value)}
      />
      <p
        id={`${id}-hint`}
        className={`mt-1 text-xs ${ok ? MUTED : "text-red-600 dark:text-red-400"}`}
      >
        {hint}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className={`text-sm ${MUTED}`}>{tr("teamIntro", d)}</p>
      {field(
        "team-operators",
        tr("teamOperators", d),
        tr("teamOperatorsHint", d),
        operators,
        setOperators,
        ops.ok
      )}
      {field(
        "team-shift",
        tr("teamShiftHours", d),
        tr("teamShiftHoursHint", d),
        shiftHours,
        setShiftHours,
        hours.ok && hours.value != null
      )}
      {field(
        "team-capacity",
        tr("teamCapacity", d),
        tr("teamCapacityHint", d),
        capacity,
        setCapacity,
        cap.ok
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          color="blue"
          disabled={busy || !valid}
          onClick={() => void save()}
        >
          {tr("save", d)}
        </Button>
        <output className={`text-sm ${MUTED}`}>
          {saved ? tr("teamSaved", d) : null}
        </output>
      </div>
    </div>
  );
}

/** The organization's telephony is chosen in its own section; Equipo links there. */
export function TelephonyLink({
  d,
  lang,
}: Readonly<{ d: I18nRecord; lang: string }>) {
  const { can } = useControlTowerAccess();
  if (!can("controltower:settings.update")) return null;
  return (
    <p
      className={`border-t border-gray-200 pt-4 text-xs dark:border-gray-700 ${MUTED}`}
    >
      {tr("telephonyMoved", d)}{" "}
      <Link
        href={telephonySettingsHref(lang)}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {tr("telephonyGo", d)}
      </Link>
    </p>
  );
}
