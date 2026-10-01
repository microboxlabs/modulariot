"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import SymptomIcon from "../components/symtom-icon";
import {
  channelGroups,
  levelsOf,
  operatorLevels,
  shortThreshold,
  type ChannelGroup,
} from "./catalog-derive";
import { ago, fmt, levelName, levelShortName } from "./catalog-format";
import type { SymptomSummary } from "./maintainer-api";
import { renderDescription } from "./rule-description";
import { familyLabel } from "./symptom-labels";
import { MUTED } from "./ui/card";
import { LevelIcon } from "./ui/level-icon";
import { StatePill } from "./ui/state";

const TAG =
  "rounded-md bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
const DRAFT_TAG =
  "rounded bg-amber-100 px-1.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

export function channelGroupLabel(g: ChannelGroup, d: I18nRecord) {
  return trDynamic(`channelGroup_${g}`, d);
}

/** "☎ Operador en Crítica, Código negro" or "Solo avisos". */
export function whoActs(s: SymptomSummary, d: I18nRecord) {
  const levels = operatorLevels(s.current?.spec ?? null)
    .map((on, i) => (on ? levelShortName(i + 1, d) : null))
    .filter(Boolean);
  return levels.length
    ? tr("operatorIn", d, { levels: levels.join(", ") })
    : tr("onlyNotices", d);
}

function thresholdText(t: string | null, d: I18nRecord) {
  if (t === "fixed") return tr("thresholdFixed", d);
  if (t === "custom") return tr("thresholdCustom", d);
  return t ?? tr("notApplicable", d);
}

/** Each level draws its piece of the line at its icon's center; the ends stop at the first and last icon. */
const LINE_SPAN = [
  "left-1/2 right-0",
  "left-0 right-0",
  "left-0 right-0",
  "left-0 right-1/2",
];

function Ladder({ s, d }: Readonly<{ s: SymptomSummary; d: I18nRecord }>) {
  const spec = s.current?.spec ?? null;
  const unit = spec?.measure?.unit ?? null;
  const ops = operatorLevels(spec);
  return (
    <div className="mx-4 mt-3 grid grid-cols-4 rounded-lg bg-gray-50 px-2 pb-2 pt-3 dark:bg-gray-900/50">
      {levelsOf(spec).map((level, i) => {
        const icu = i + 1;
        const t = shortThreshold(level, unit);
        return (
          <div
            key={icu}
            title={`${levelName(icu, d)}: ${thresholdText(t, d)}`}
            className="flex flex-col items-center gap-1 px-0.5 text-center"
          >
            <div className="relative flex w-full justify-center">
              <div
                className={`absolute top-1/2 h-px bg-gray-200 dark:bg-gray-600 ${LINE_SPAN[i]}`}
              />
              <span className="relative">
                <LevelIcon icu={icu} empty={!t} />
              </span>
            </div>
            <span
              className={`text-[11px] leading-tight ${t ? "text-gray-700 dark:text-gray-200" : MUTED}`}
            >
              {thresholdText(t, d)}
            </span>
            {t && ops[i] && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                {tr("operatorMark", d)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Activation({ s, d }: Readonly<{ s: SymptomSummary; d: I18nRecord }>) {
  const text = s.activationText;
  const fallback =
    s.definition.description ?? s.current?.spec?.activation ?? "";
  return (
    <p className="mt-3 line-clamp-2 min-h-[2.5rem] px-4 text-xs text-gray-600 dark:text-gray-300">
      {tr("activatesOn", d)}{" "}
      {text ? renderDescription(text) : fallback || tr("noActivation", d)}
    </p>
  );
}

export function SymptomIconCircle({
  s,
  rootDict,
  size,
}: Readonly<{ s: SymptomSummary; rootDict: I18nRecord; size: string }>) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200 dark:text-gray-700 ${size}`}
    >
      <SymptomIcon
        type={s.definition.icon ?? s.definition.name}
        dict={rootDict}
        size={size}
        fixed_label={s.definition.name}
      />
    </span>
  );
}

export function SymptomCard({
  s,
  week,
  lang,
  d,
  rootDict,
  onOpen,
}: Readonly<{
  s: SymptomSummary;
  week: number | null;
  lang: string;
  d: I18nRecord;
  rootDict: I18nRecord;
  onOpen: () => void;
}>) {
  const def = s.definition;
  const channels = channelGroups(s.current?.spec ?? null);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex cursor-pointer flex-col rounded-lg border border-gray-200 bg-white text-left transition hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
    >
      <div className="flex w-full items-start gap-3 px-4 pt-4">
        <SymptomIconCircle s={s} rootDict={rootDict} size="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900 dark:text-white">
            {def.name}
          </div>
          <div className={`text-xs ${MUTED}`}>{familyLabel(def.family)}</div>
        </div>
        <StatePill state={def.state} d={d} />
      </div>
      <Activation s={s} d={d} />
      <Ladder s={s} d={d} />
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4 text-xs">
        <span className={TAG}>{whoActs(s, d)}</span>
        {channels.map((g) => (
          <span key={g} className={TAG}>
            {channelGroupLabel(g, d)}
          </span>
        ))}
      </div>
      <div
        className={`mt-3 flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs dark:border-gray-700/60 ${MUTED}`}
      >
        <span className="font-mono">
          {def.currentVersion ? `v${def.currentVersion}` : tr("unpublished", d)}
        </span>
        <span>· {ago(def.updatedAt, lang)}</span>
        {s.hasDraft && <span className={DRAFT_TAG}>{tr("draftTag", d)}</span>}
        <span className="ml-auto tabular-nums">
          {week == null ? "—" : tr("perWeek", d, { n: fmt(week, lang) })}
        </span>
      </div>
    </button>
  );
}

export function SymptomRow({
  s,
  week,
  lang,
  d,
  rootDict,
  onOpen,
}: Readonly<{
  s: SymptomSummary;
  week: number | null;
  lang: string;
  d: I18nRecord;
  rootDict: I18nRecord;
  onOpen: () => void;
}>) {
  const def = s.definition;
  const unit = s.current?.spec?.measure?.unit ?? null;
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
      <td className="px-4 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-2.5 text-left"
        >
          <SymptomIconCircle s={s} rootDict={rootDict} size="h-8 w-8" />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {def.name}
            </div>
            <div className={MUTED}>{familyLabel(def.family)}</div>
          </div>
        </button>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-1.5">
          {levelsOf(s.current?.spec ?? null).map((level, i) => {
            const t = shortThreshold(level, unit);
            return (
              <span
                key={level?.icu ?? `missing-${i}`}
                title={`${levelName(i + 1, d)}: ${thresholdText(t, d)}`}
                className={t ? "" : "opacity-60"}
              >
                <LevelIcon icu={i + 1} size="h-6 w-6" empty={!t} />
              </span>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-2.5">{whoActs(s, d)}</td>
      <td className="px-4 py-2.5">
        <StatePill state={def.state} d={d} />
      </td>
      <td className="px-4 py-2.5">
        <span className="font-mono">{def.currentVersion ?? "—"}</span>
        {s.hasDraft && (
          <span className={`ml-1 ${DRAFT_TAG}`}>{tr("draftTag", d)}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {week == null ? "—" : fmt(week, lang)}
      </td>
    </tr>
  );
}
