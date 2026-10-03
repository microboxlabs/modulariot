"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ruleKey } from "./condition-form";
import {
  type Level,
  type SymptomSpec,
  type SymptomStats,
  useSymptomStats,
} from "./maintainer-api";
import { Panel } from "./symptom-side-panels";
import { ICU_LEVELS } from "./symptom-labels";
import { LevelIcon } from "./ui/level-icon";

/** How the spec on screen treats a level next to the version in force. */
export type LevelMark = "same" | "changed" | "off";

const levelAt = (spec: SymptomSpec | null | undefined, icu: number) =>
  spec?.levels?.find((l) => l.icu === icu);

const sameRule = (a: Level | undefined, b: Level | undefined) =>
  ruleKey(a?.when ?? "") === ruleKey(b?.when ?? "");

/** Per level: off in the spec, the same threshold as in force, or a changed one (no estimate for those). */
export function levelMarks(
  spec: SymptomSpec,
  published: SymptomSpec | null | undefined
): Map<number, LevelMark> {
  const out = new Map<number, LevelMark>();
  for (const { icu } of ICU_LEVELS) {
    const now = levelAt(spec, icu);
    const before = levelAt(published, icu);
    if (!now?.applies) out.set(icu, "off");
    else if (!published || (before?.applies && sameRule(now, before)))
      out.set(icu, "same");
    else out.set(icu, "changed");
  }
  return out;
}

/** The spec opens cases on other records than the version in force: its source or activation changed. */
export function activationChanged(
  spec: SymptomSpec,
  published: SymptomSpec | null | undefined
): boolean {
  if (!published) return false;
  return (
    (spec.source ?? null) !== (published.source ?? null) ||
    ruleKey(spec.activation ?? "") !== ruleKey(published.activation ?? "")
  );
}

/** Cases a shift would bring to operators: the weekly cases of the levels the spec sends to an operator. */
export function casesPerShift(
  spec: SymptomSpec,
  weekByLevel: number[],
  shiftHours: number
): number {
  const week = ICU_LEVELS.filter(({ icu }) => {
    const level = levelAt(spec, icu);
    return level?.applies && level.response?.operator;
  }).reduce((sum, { icu }) => sum + (weekByLevel[icu - 1] ?? 0), 0);
  const shiftsPerWeek = (7 * 24) / Math.max(1, shiftHours);
  return Math.round(week / shiftsPerWeek);
}

const MARK: Record<LevelMark, { sign: string; cls: string; key: string }> = {
  same: { sign: "=", cls: "text-gray-400", key: "impactSame" },
  changed: {
    sign: "≠",
    cls: "font-semibold text-amber-600 dark:text-amber-400",
    key: "impactChanged",
  },
  off: { sign: "—", cls: "text-gray-400", key: "impactOff" },
};

function Rows({
  spec,
  published,
  stats,
  definitionId,
  d,
}: Readonly<{
  spec: SymptomSpec;
  published: SymptomSpec | null | undefined;
  stats: SymptomStats;
  definitionId: string;
  d: I18nRecord;
}>) {
  const row = stats.symptoms.find((s) => s.definitionId === definitionId);
  const week = row?.weekByLevel ?? [0, 0, 0, 0];
  const marks = levelMarks(spec, published);
  const perShift = casesPerShift(spec, week, stats.operators.shiftHours);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("impactWindow", d)}
      </p>
      <ul className="flex flex-col gap-1.5">
        {ICU_LEVELS.map(({ icu }) => {
          const mark = MARK[marks.get(icu) ?? "same"];
          const name = trDynamic(`levelName${icu}`, d);
          return (
            <li key={icu} className="flex items-center gap-2">
              <LevelIcon icu={icu} label={name} size="h-5 w-5" />
              <span className="flex-1 text-gray-700 dark:text-gray-300">
                {name}
              </span>
              <span className="tabular-nums text-gray-900 dark:text-white">
                {(week[icu - 1] ?? 0).toLocaleString("es-CL")}
              </span>
              <span
                title={trDynamic(mark.key, d)}
                className={`w-4 text-center ${mark.cls}`}
              >
                <span aria-hidden>{mark.sign}</span>
                <span className="sr-only">{trDynamic(mark.key, d)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="flex items-baseline gap-2 pt-1">
        <span className="text-3xl font-semibold text-gray-900 dark:text-white">
          {perShift}
        </span>
        <span className="text-gray-600 dark:text-gray-300">
          {tr("impactPerShift", d)}
        </span>
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("impactNote", d)}
      </p>
      {activationChanged(spec, published) && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {tr("impactActivationChanged", d)}
        </p>
      )}
    </div>
  );
}

/**
 * "Cómo afecta": the symptom's weekly cases per level (average of the last 90
 * days), whether the spec on screen keeps each level's threshold, and the cases
 * per shift its operator levels would bring.
 */
export default function ImpactPanel({
  definitionId,
  spec,
  published,
  d,
}: Readonly<{
  definitionId: string;
  spec: SymptomSpec;
  published: SymptomSpec | null | undefined;
  d: I18nRecord;
}>) {
  const { data: stats } = useSymptomStats();
  return (
    <Panel title={tr("impactTitle", d)}>
      {stats?.engineAvailable ? (
        <Rows
          spec={spec}
          published={published}
          stats={stats}
          definitionId={definitionId}
          d={d}
        />
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {stats ? tr("impactNoEngine", d) : tr("impactLoading", d)}
        </p>
      )}
    </Panel>
  );
}
