"use client";

import { useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ControlTowerError } from "../control-tower/control-tower-api";
import { saveTowerTeam, useTowerTeam, type TowerTeam } from "./maintainer-api";
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
 * The operator team used by the operator load card: operators, shift length,
 * cases a shift can handle. The form waits for the saved team, so a save never
 * starts from blanks.
 */
export default function TeamSettingsModal({
  d,
  onClose,
}: Readonly<{
  d: I18nRecord;
  onClose: () => void;
}>) {
  const { data: team, error } = useTowerTeam(true);
  return (
    <Modal show size="md" onClose={onClose} dismissible>
      <ModalHeader>{tr("teamTitle", d)}</ModalHeader>
      {team ? (
        <TeamForm team={team} d={d} onClose={onClose} />
      ) : (
        <ModalBody>
          <p
            role={error ? "alert" : "status"}
            className={`text-sm ${error ? "text-red-600 dark:text-red-400" : MUTED}`}
          >
            {error ? tr("teamLoadFailed", d) : tr("loading", d)}
          </p>
        </ModalBody>
      )}
    </Modal>
  );
}

function TeamForm({
  team,
  d,
  onClose,
}: Readonly<{
  team: TowerTeam;
  d: I18nRecord;
  onClose: () => void;
}>) {
  const [operators, setOperators] = useState(text(team.operators));
  const [shiftHours, setShiftHours] = useState(String(team.shiftHours));
  const [capacity, setCapacity] = useState(text(team.capacityPerShift));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ops = parseCount(operators, 0, MAX_OPERATORS);
  const hours = parseCount(shiftHours, 1, 24);
  const cap = parseCount(capacity, 0, MAX_CAPACITY);
  const valid = ops.ok && hours.ok && hours.value != null && cap.ok;

  const save = async () => {
    if (!ops.ok || !hours.ok || hours.value == null || !cap.ok) return;
    setBusy(true);
    setError(null);
    try {
      await saveTowerTeam({
        operators: ops.value,
        shiftHours: hours.value,
        capacityPerShift: cap.value,
      });
      onClose();
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
        value={value}
        color={ok ? undefined : "failure"}
        aria-invalid={!ok}
        aria-describedby={`${id}-hint`}
        onChange={(e) => setValue(e.target.value)}
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
    <>
      <ModalBody>
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
        </div>
        <TelephonyLink d={d} />
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button disabled={busy || !valid} onClick={() => void save()}>
          {tr("save", d)}
        </Button>
      </ModalFooter>
    </>
  );
}

/** The organization's telephony is chosen in Conexiones; the modal only links there. */
export function TelephonyLink({ d }: Readonly<{ d: I18nRecord }>) {
  const { lang } = useParams<{ lang: string }>();
  return (
    <p
      className={`mt-4 border-t border-gray-200 pt-4 text-xs dark:border-gray-700 ${MUTED}`}
    >
      {tr("telephonyMoved", d)}{" "}
      <Link
        href={`/${lang}/users/settings/connections`}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {tr("telephonyConnections", d)}
      </Link>
    </p>
  );
}
