"use client";

import { HiCheckCircle, HiExclamation, HiXCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import ConditionIcon from "../components/condition-icon";
import { insertIntoFocused } from "./cel-editor";
import type {
  DataSource,
  FieldOrigin,
  Preview,
  ValidationReport,
} from "./maintainer-api";
import { ICU_LEVELS } from "./symptom-labels";

const cardClass =
  "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

export function Panel({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className={cardClass}>
      <div className="border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

const ORIGIN_KEY: Record<FieldOrigin, string> = {
  DEVICE: "originDevice",
  TRIP: "originTrip",
  VEHICLE: "originVehicle",
  ROAD_NETWORK: "originRoad",
  ZONES: "originZones",
  TENANT_SETTINGS: "originTenant",
  CALCULATED: "originCalculated",
  CONNECTION: "originConnection",
};

export function originLabel(origin: FieldOrigin | null, d: I18nRecord) {
  return origin ? trDynamic(ORIGIN_KEY[origin], d) : "";
}

/** A sample value as text; objects and arrays are shown as JSON. */
function sampleText(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

function valueAt(
  sample: Record<string, unknown> | undefined,
  path: string
): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      sample
    );
}

/** The checks: whether it can be published, and each finding. */
export function ReviewPanel({
  report,
  d,
}: Readonly<{ report: ValidationReport | null; d: I18nRecord }>) {
  if (!report) return <Panel title={tr("review", d)}>…</Panel>;
  const errors = report.findings.filter((f) => f.severity === "ERROR");
  const warnings = report.findings.filter((f) => f.severity === "WARNING");
  return (
    <Panel title={tr("review", d)}>
      <p
        className={`flex items-center gap-1.5 text-sm font-medium ${report.publishable ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
      >
        {report.publishable ? (
          <HiCheckCircle className="h-4 w-4" />
        ) : (
          <HiXCircle className="h-4 w-4" />
        )}
        {report.publishable
          ? tr("publishable", d)
          : tr("notPublishable", d, { count: String(errors.length) })}
      </p>
      {report.needsTestOnly && (
        <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
          {tr("testOnly", d)}
        </p>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {[...errors, ...warnings].map((f) => (
          <li
            key={`${f.section}-${f.message}`}
            className="flex gap-1.5 text-xs text-gray-700 dark:text-gray-300"
          >
            <HiExclamation
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${f.severity === "ERROR" ? "text-red-500" : "text-yellow-500"}`}
            />
            {f.message}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** What the rules do on the source's samples: activates, measure and level. */
export function PreviewPanel({
  preview,
  d,
  rootDict,
}: Readonly<{ preview: Preview | null; d: I18nRecord; rootDict: I18nRecord }>) {
  const samples = preview?.samples ?? [];
  return (
    <Panel title={tr("preview", d)}>
      {samples.length === 0 && (
        <p className="text-xs text-gray-500">{tr("noSamples", d)}</p>
      )}
      <ul className="flex flex-col gap-2">
        {samples.map((s, i) => {
          const level = ICU_LEVELS.find((l) => l.icu === s.level);
          const key = `sample-${i}`;
          if (s.error) {
            return (
              <li key={key} className="text-xs text-red-600 dark:text-red-400">
                {tr("sample", d, { n: String(i + 1) })}: {s.error}
              </li>
            );
          }
          return (
            <li
              key={key}
              className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300"
            >
              <span className="w-16 shrink-0 text-gray-500">
                {tr("sample", d, { n: String(i + 1) })}
              </span>
              <span className="flex-1">
                {s.activates ? tr("activates", d) : tr("doesNotActivate", d)}
                {s.measure != null
                  ? ` · ${tr("measure", d).toLowerCase()} ${Math.round(s.measure * 10) / 10}`
                  : ""}
              </span>
              {level ? (
                <ConditionIcon
                  condition={level.condition}
                  dict={rootDict}
                  size="h-6 w-6"
                />
              ) : (
                <span className="w-6 text-center">—</span>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The source's fields with type, origin and the first sample's value. Clicking one inserts it in the editor used last. */
export function FieldsPanel({
  source,
  d,
}: Readonly<{ source: DataSource | undefined; d: I18nRecord }>) {
  const sample = source?.samples?.[0];
  return (
    <Panel
      title={
        source ? tr("fieldsOf", d, { source: source.name }) : tr("fields", d)
      }
    >
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {tr("fieldsHint", d)}
      </p>
      <ul className="flex flex-col gap-0.5">
        {(source?.fields ?? []).map((f) => {
          const value = valueAt(sample, f.path);
          return (
            <li key={f.path}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertIntoFocused(f.path)}
                className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-gray-900 dark:text-gray-100">
                  {f.path}
                </span>
                {value !== undefined && (
                  <span className="shrink-0 font-mono text-gray-500">
                    {sampleText(value)}
                  </span>
                )}
                {f.origin && (
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {originLabel(f.origin, d)}
                  </span>
                )}
                {!f.engineSupported && (
                  <span className="shrink-0 text-[10px] text-yellow-700 dark:text-yellow-400">
                    {tr("testOnlyField", d)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
