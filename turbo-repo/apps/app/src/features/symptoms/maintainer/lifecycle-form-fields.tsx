"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { NumberValue } from "./activation-form";
import {
  type CloseWhen,
  type OpenWhen,
  compileClose,
  compileOpen,
  parseClose,
  parseOpen,
} from "./lifecycle-form";

type Lifecycle = {
  open: string | null;
  close: string | null;
  levelDown?: boolean;
};

const selectClass =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const labelClass =
  "text-xs font-semibold uppercase tracking-wide text-gray-500";

/** What a case starts from when its open or close kind changes. */
const DEFAULT_OPEN_SECONDS = 30;
const DEFAULT_CLOSE_MINUTES = 2;
const DEFAULT_EXPIRE_HOURS = 12;

function OpenRow({
  open,
  readOnly,
  d,
  onChange,
}: Readonly<{
  open: OpenWhen;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (open: OpenWhen) => void;
}>) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        aria-label={tr("opens", d)}
        className={selectClass}
        disabled={readOnly}
        value={open.kind}
        onChange={(e) =>
          onChange(
            e.target.value === "instant"
              ? { kind: "instant" }
              : { kind: "sustained", seconds: DEFAULT_OPEN_SECONDS }
          )
        }
      >
        <option value="instant">{tr("openInstant", d)}</option>
        <option value="sustained">{tr("openSustained", d)}</option>
      </select>
      {open.kind === "sustained" && (
        <NumberValue
          value={open.seconds}
          unit="s"
          label={tr("openSeconds", d)}
          accept={(n) => n >= 0}
          readOnly={readOnly}
          onChange={(seconds) => onChange({ kind: "sustained", seconds })}
        />
      )}
    </span>
  );
}

function closeOf(kind: string): CloseWhen {
  if (kind === "operator") return { kind: "operator" };
  if (kind === "expire") return { kind: "expire", hours: DEFAULT_EXPIRE_HOURS };
  return { kind: "normal", minutes: DEFAULT_CLOSE_MINUTES };
}

function CloseRow({
  close,
  readOnly,
  d,
  onChange,
}: Readonly<{
  close: CloseWhen;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (close: CloseWhen) => void;
}>) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        aria-label={tr("closes", d)}
        className={selectClass}
        disabled={readOnly}
        value={close.kind}
        onChange={(e) => onChange(closeOf(e.target.value))}
      >
        <option value="normal">{tr("closeNormal", d)}</option>
        <option value="operator">{tr("closeOperator", d)}</option>
        <option value="expire">{tr("closeExpire", d)}</option>
      </select>
      {close.kind === "normal" && (
        <NumberValue
          value={close.minutes}
          unit="min"
          label={tr("closeMinutes", d)}
          accept={(n) => n >= 0}
          readOnly={readOnly}
          onChange={(minutes) => onChange({ kind: "normal", minutes })}
        />
      )}
      {close.kind === "expire" && (
        <NumberValue
          value={close.hours}
          unit="h"
          label={tr("closeHours", d)}
          accept={(n) => n > 0}
          readOnly={readOnly}
          onChange={(hours) => onChange({ kind: "expire", hours })}
        />
      )}
    </span>
  );
}

/** The level-down choice, which is not a rule and shows in both modes. */
export function LevelDownSelect({
  levelDown,
  readOnly,
  d,
  onChange,
}: Readonly<{
  levelDown: boolean;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (levelDown: boolean) => void;
}>) {
  return (
    <select
      aria-label={tr("levelGoesDown", d)}
      className={selectClass}
      disabled={readOnly}
      value={levelDown ? "follow" : "never"}
      onChange={(e) => onChange(e.target.value === "follow")}
    >
      <option value="never">{tr("downNever", d)}</option>
      <option value="follow">{tr("downFollow", d)}</option>
    </select>
  );
}

/**
 * Ciclo del caso as the prototype's form: Se abre, Sube, Baja, Se cierra, Si
 * vuelve. Null when the open or close rule says something the form cannot show.
 */
export default function LifecycleFormFields({
  lifecycle,
  readOnly,
  d,
  onChange,
}: Readonly<{
  lifecycle: Lifecycle;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (lifecycle: Lifecycle) => void;
}>) {
  const open = parseOpen(lifecycle.open);
  const close = parseClose(lifecycle.close);
  if (!open || !close) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2 text-sm text-gray-700 dark:text-gray-200">
      <span className={labelClass}>{tr("lifeOpens", d)}</span>
      <OpenRow
        open={open}
        readOnly={readOnly}
        d={d}
        onChange={(o) => onChange({ ...lifecycle, open: compileOpen(o) })}
      />
      <span className={labelClass}>{tr("lifeRises", d)}</span>
      <span>{tr("risesText", d)}</span>
      <span className={labelClass}>{tr("lifeFalls", d)}</span>
      <span>
        <LevelDownSelect
          levelDown={lifecycle.levelDown ?? false}
          readOnly={readOnly}
          d={d}
          onChange={(levelDown) => onChange({ ...lifecycle, levelDown })}
        />
      </span>
      <span className={labelClass}>{tr("lifeCloses", d)}</span>
      <CloseRow
        close={close}
        readOnly={readOnly}
        d={d}
        onChange={(c) => onChange({ ...lifecycle, close: compileClose(c) })}
      />
      <span className={labelClass}>{tr("lifeReturns", d)}</span>
      <span>{tr("returnsText", d)}</span>
    </div>
  );
}
