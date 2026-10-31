"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import LevelResponseDetail from "./level-response";
import { EMPTY_RESPONSE, levelOf, withLevel } from "./level-row";
import type {
  Finding,
  LevelResponse,
  Preview,
  SymptomSpec,
} from "./maintainer-api";
import { useSourceSamples } from "./sample-tree";
import { ICU_LEVELS } from "./symptom-labels";
import { CHANGED_DOT } from "./ui/changed";
import { LevelIcon } from "./ui/level-icon";
import { FIELD } from "./ui/response-block";
import Select from "./ui/select";

const responseSection = (icu: number) => `levels.${icu}.response`;

function errorCount(findings: Finding[] | undefined, icu: number): number {
  return (findings ?? []).filter(
    (f) => f.section === responseSection(icu) && f.severity === "ERROR"
  ).length;
}

/** The level shown first: one with an error, else the highest that applies. */
export function firstResponseLevel(
  spec: SymptomSpec,
  findings: Finding[] | undefined
): number {
  const applying = ICU_LEVELS.map((m) => m.icu).filter(
    (icu) => levelOf(spec, icu).applies
  );
  return (
    applying.find((icu) => errorCount(findings, icu) > 0) ??
    applying.at(-1) ??
    4
  );
}

function summaryText(response: LevelResponse, d: I18nRecord): string {
  if (!response.operator) return tr("noOperator", d);
  const sla = tr("operatorSla", d, {
    minutes: String(response.slaMinutes ?? ""),
  });
  const steps = response.steps?.length ?? 0;
  if (steps === 0) return sla;
  const count =
    steps === 1
      ? tr("stepsCountOne", d)
      : tr("stepsCount", d, { n: String(steps) });
  return `${sla} · ${count}`;
}

function LevelItem({
  spec,
  icu,
  selected,
  changed,
  errors,
  d,
  onSelect,
}: Readonly<{
  spec: SymptomSpec;
  icu: number;
  selected: boolean;
  changed: boolean;
  errors: number;
  d: I18nRecord;
  onSelect: () => void;
}>) {
  const level = levelOf(spec, icu);
  const response = level.response ?? EMPTY_RESPONSE;
  const name = trDynamic(`levelName${icu}`, d);
  const tone = selected
    ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
    : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50";
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left ${tone}`}
    >
      <LevelIcon icu={icu} label={name} empty={!level.applies} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${level.applies ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
          >
            {name}
          </span>
          {changed && (
            <span
              className={`h-1.5 w-1.5 rounded-full ${CHANGED_DOT}`}
              title={tr("levelChanged", d)}
            />
          )}
          {errors > 0 && (
            <span className="ml-auto rounded-md bg-red-100 px-1.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {errors}
            </span>
          )}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {level.applies ? summaryText(response, d) : tr("levelNotApplies", d)}
        </span>
      </span>
    </button>
  );
}

function CopyFrom({
  spec,
  icu,
  readOnly,
  d,
  onCopy,
}: Readonly<{
  spec: SymptomSpec;
  icu: number;
  readOnly: boolean;
  d: I18nRecord;
  onCopy: (from: number) => void;
}>) {
  const sources = ICU_LEVELS.map((m) => m.icu).filter(
    (other) => other !== icu && levelOf(spec, other).applies
  );
  if (readOnly || sources.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      {tr("copyResponseFrom", d)}
      <Select
        aria-label={tr("copyResponseFrom", d)}
        className={FIELD}
        value=""
        onChange={(e) => {
          if (e.target.value) onCopy(Number(e.target.value));
        }}
      >
        <option value="">{tr("copyResponsePick", d)}</option>
        {sources.map((other) => (
          <option key={other} value={other}>
            {trDynamic(`levelName${other}`, d)}
          </option>
        ))}
      </Select>
    </label>
  );
}

/**
 * "Respuesta": what the tower does at each level, set up one level at a time
 * beside the list of levels, without the signal or the rule on screen.
 */
export default function ResponseWorkspace({
  spec,
  symptom,
  changedLevels,
  preview,
  findings,
  readOnly,
  icu,
  d,
  onIcu,
  onChange,
}: Readonly<{
  spec: SymptomSpec;
  /** The symptom whose conversation rules each level lists; absent for a template. */
  symptom?: { key: string; name: string };
  /** Levels that differ from the published version. */
  changedLevels: ReadonlySet<number>;
  preview?: Preview;
  findings: Finding[] | undefined;
  readOnly: boolean;
  icu: number;
  d: I18nRecord;
  onIcu: (icu: number) => void;
  onChange: (spec: SymptomSpec) => void;
}>) {
  // Step scripts are previewed with the first sample of the source.
  const sample = useSourceSamples(preview, spec.source)[0]?.sample;
  const level = levelOf(spec, icu);
  const response = level.response ?? EMPTY_RESPONSE;
  const name = trDynamic(`levelName${icu}`, d);
  const setResponse = (next: LevelResponse) =>
    onChange(withLevel(spec, { ...level, response: next }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav
        aria-label={tr("responseLevels", d)}
        className="flex flex-col gap-1 self-start rounded-lg border border-gray-200 bg-white p-2 lg:sticky lg:top-0 dark:border-gray-700 dark:bg-gray-800"
      >
        <span className="px-3 pt-1 pb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {tr("responseLevels", d)}
        </span>
        {ICU_LEVELS.map((m) => (
          <LevelItem
            key={m.icu}
            spec={spec}
            icu={m.icu}
            selected={m.icu === icu}
            changed={changedLevels.has(m.icu)}
            errors={errorCount(findings, m.icu)}
            d={d}
            onSelect={() => onIcu(m.icu)}
          />
        ))}
      </nav>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <LevelIcon
            icu={icu}
            label={name}
            size="h-9 w-9"
            empty={!level.applies}
          />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {name}
          </h3>
          {level.applies && (
            <span className="ml-auto">
              <CopyFrom
                spec={spec}
                icu={icu}
                readOnly={readOnly}
                d={d}
                onCopy={(from) =>
                  setResponse(
                    structuredClone(
                      levelOf(spec, from).response ?? EMPTY_RESPONSE
                    )
                  )
                }
              />
            </span>
          )}
        </div>
        {level.applies ? (
          <LevelResponseDetail
            response={response}
            findings={(findings ?? []).filter(
              (f) => f.section === responseSection(icu)
            )}
            sample={sample}
            symptom={symptom && { ...symptom, icu }}
            readOnly={readOnly}
            d={d}
            onChange={(patch) => setResponse({ ...response, ...patch })}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {tr("levelNotAppliesHint", d)}
          </p>
        )}
      </div>
    </div>
  );
}
