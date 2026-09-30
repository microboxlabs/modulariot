"use client";

import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ConditionIcon from "../components/condition-icon";
import SymptomIcon from "../components/symtom-icon";
import {
  useSymptomDefinition,
  type SymptomSpec,
  type SymptomVersion,
} from "./maintainer-api";
import { ICU_LEVELS, StateBadge, familyLabel } from "./symptom-labels";

const cardClass =
  "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";
const sectionTitle =
  "text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white";

function Rule({ text }: Readonly<{ text: string | null | undefined }>) {
  return (
    <code className="block whitespace-pre-wrap break-words rounded-md bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
      {text || "—"}
    </code>
  );
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className={cardClass}>
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className={sectionTitle}>{title}</h2>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">{children}</div>
    </section>
  );
}

function Levels({
  spec,
  d,
  rootDict,
}: Readonly<{ spec: SymptomSpec; d: I18nRecord; rootDict: I18nRecord }>) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {ICU_LEVELS.map((meta) => {
        const level = (spec.levels ?? []).find((l) => l.icu === meta.icu);
        const applies = level?.applies ?? false;
        return (
          <div
            key={meta.icu}
            className={`flex items-start gap-3 py-2.5 ${applies ? "" : "opacity-50"}`}
          >
            <ConditionIcon
              condition={meta.condition}
              dict={rootDict}
              size="h-8 w-8"
            />
            <div className="min-w-0 flex-1">
              {applies ? (
                <Rule text={level?.when} />
              ) : (
                <p className="py-1 text-sm text-gray-500">
                  {tr("levelOff", d)}
                </p>
              )}
            </div>
            {applies && level?.response?.operator && (
              <span className="shrink-0 text-xs text-gray-600 dark:text-gray-300">
                {tr("operatorSla", d, {
                  minutes: String(level.response.slaMinutes ?? "—"),
                })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Versions({
  versions,
  d,
}: Readonly<{ versions: SymptomVersion[]; d: I18nRecord }>) {
  return (
    <ol className="flex flex-col gap-2">
      {versions.map((v) => (
        <li key={v.id} className="text-sm">
          <span className="font-mono font-semibold text-gray-900 dark:text-white">
            v{v.version}
          </span>
          <span className="ml-2 text-xs text-gray-500">{v.bump}</span>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {v.reason}
            {v.rolledBackFrom
              ? ` · ${tr("restores", d, { version: v.rolledBackFrom })}`
              : ""}
          </p>
          <p className="text-xs text-gray-400">
            {v.publishedBy} ·{" "}
            {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** One symptom: its rules as they are in force (or the draft), and its versions. */
export default function SymptomDetail({
  id,
  dict,
  rootDict,
  lang,
}: Readonly<{
  id: string;
  dict: I18nRecord;
  rootDict: I18nRecord;
  lang: string;
}>) {
  const d = dict?.symptomCatalog as I18nRecord;
  const { data, error } = useSymptomDefinition(id);
  const shown = data?.draft ?? data?.current;
  const spec = shown?.spec;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "symptomCatalog"]}
          disableLinks
        />
      </div>
      <div className="mx-auto flex w-full max-w-screen-xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-10 dark:bg-gray-900">
        <Link
          href={`/${lang}/users/settings/symptoms`}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          {tr("backToCatalog", d)}
        </Link>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("loadFailed", d)}
          </p>
        )}
        {data && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-200">
                <SymptomIcon
                  type={data.definition.icon ?? data.definition.name}
                  dict={rootDict}
                  size="h-10 w-10"
                  fixed_label={data.definition.name}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-semibold text-gray-900 dark:text-white">
                  {data.definition.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {familyLabel(data.definition.family)}
                  {data.definition.currentVersion
                    ? ` · v${data.definition.currentVersion}`
                    : ""}
                  {data.draft ? ` · ${tr("showingDraft", d)}` : ""}
                </p>
              </div>
              <StateBadge state={data.definition.state} d={d} />
            </div>
            {spec && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-4 lg:col-span-2">
                  <Section title={tr("sectionActivation", d)}>
                    <Rule text={spec.activation} />
                  </Section>
                  <Section title={tr("sectionLevels", d)}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("measure", d)}:{" "}
                      <span className="font-mono">
                        {spec.measure?.expression ?? "—"}
                      </span>
                      {spec.measure?.unit ? ` (${spec.measure.unit})` : ""}
                    </p>
                    <Levels spec={spec} d={d} rootDict={rootDict} />
                  </Section>
                  <Section title={tr("sectionLifecycle", d)}>
                    <p className="text-xs text-gray-500">{tr("opens", d)}</p>
                    <Rule text={spec.lifecycle?.open} />
                    <p className="text-xs text-gray-500">{tr("closes", d)}</p>
                    <Rule text={spec.lifecycle?.close} />
                  </Section>
                </div>
                <Section title={tr("sectionVersions", d)}>
                  {data.versions.length ? (
                    <Versions versions={data.versions} d={d} />
                  ) : (
                    <p className="text-sm text-gray-500">
                      {tr("unpublished", d)}
                    </p>
                  )}
                </Section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
