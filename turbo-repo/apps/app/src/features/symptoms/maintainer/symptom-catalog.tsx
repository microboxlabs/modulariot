"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextInput } from "flowbite-react";
import {
  HiOutlineSearch,
  HiOutlineViewGrid,
  HiOutlineViewList,
  HiPlus,
} from "react-icons/hi";
import { MdOutlineMonitorHeart } from "react-icons/md";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import SymptomIcon from "../components/symtom-icon";
import CreateSymptomModal from "./create-symptom-modal";
import {
  useSymptomDefinitions,
  type SymptomState,
  type SymptomSummary,
} from "./maintainer-api";
import { StateBadge, familyLabel } from "./symptom-labels";

type Filter = "ALL" | SymptomState | "DRAFT";
type View = "cards" | "list";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "filterAll" },
  { key: "ACTIVE", label: "stateActive" },
  { key: "TEST", label: "stateTest" },
  { key: "OFF", label: "stateOff" },
  { key: "DRAFT", label: "withDraft" },
];

const cardClass =
  "flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

function matches(s: SymptomSummary, filter: Filter, query: string) {
  const d = s.definition;
  if (filter === "DRAFT" && !s.hasDraft) return false;
  if (filter !== "ALL" && filter !== "DRAFT" && d.state !== filter)
    return false;
  const q = query.trim().toLowerCase();
  return (
    !q ||
    d.name.toLowerCase().includes(q) ||
    d.key.includes(q) ||
    (d.family ?? "").includes(q)
  );
}

function countOf(list: SymptomSummary[], filter: Filter) {
  return list.filter((s) => matches(s, filter, "")).length;
}

function Stat({
  label,
  value,
  hint,
}: Readonly<{ label: string; value: number; hint: string }>) {
  return (
    <section className={cardClass}>
      <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="px-4 pb-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {value}
      </div>
      <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
        {hint}
      </div>
    </section>
  );
}

function VersionText({ s, d }: Readonly<{ s: SymptomSummary; d: I18nRecord }>) {
  const v = s.definition.currentVersion;
  return (
    <span className="text-xs text-gray-500 dark:text-gray-400">
      {v ? `v${v}` : tr("unpublished", d)}
      {s.hasDraft && (
        <span className="ml-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
          {tr("draft", d)}
        </span>
      )}
    </span>
  );
}

/** Settings › Síntomas: every symptom of the organization, by state, as cards or a list. */
export default function SymptomCatalog({
  dict,
  rootDict,
  lang,
}: Readonly<{ dict: I18nRecord; rootDict: I18nRecord; lang: string }>) {
  const d = dict?.symptomCatalog as I18nRecord;
  const router = useRouter();
  const { data, error, isLoading } = useSymptomDefinitions();
  const { activeOrg } = useOrgScopes();
  const isOwner = activeOrg?.role === "OWNER";
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("cards");
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => data ?? [], [data]);
  const shown = all.filter((s) => matches(s, filter, query));
  const open = (id: string) =>
    router.push(`/${lang}/users/settings/symptoms/${id}`);

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

      <div className="mx-auto flex w-full max-w-screen-2xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-10 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={MdOutlineMonitorHeart} />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", d)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("description", d)}
              </p>
            </div>
          </div>
          {isOwner && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("newSymptom", d)}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label={tr("statActive", d)}
            value={countOf(all, "ACTIVE")}
            hint={tr("statActiveHint", d)}
          />
          <Stat
            label={tr("statTest", d)}
            value={countOf(all, "TEST")}
            hint={tr("statTestHint", d)}
          />
          <Stat
            label={tr("statOff", d)}
            value={countOf(all, "OFF")}
            hint={tr("statOffHint", d)}
          />
          <Stat
            label={tr("statDrafts", d)}
            value={countOf(all, "DRAFT")}
            hint={tr("statDraftsHint", d)}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === f.key
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {trDynamic(f.label, d)} · {countOf(all, f.key)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <TextInput
              sizing="sm"
              icon={HiOutlineSearch}
              placeholder={tr("search", d)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
              {(["cards", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  aria-label={
                    v === "cards" ? tr("viewCards", d) : tr("viewList", d)
                  }
                  onClick={() => setView(v)}
                  className={`rounded-md p-1.5 ${view === v ? "bg-gray-100 dark:bg-gray-700" : "text-gray-500"}`}
                >
                  {v === "cards" ? (
                    <HiOutlineViewGrid className="h-4 w-4" />
                  ) : (
                    <HiOutlineViewList className="h-4 w-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("loadFailed", d)}
          </p>
        )}
        {!isLoading && !error && shown.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {all.length === 0 ? tr("empty", d) : tr("emptyFiltered", d)}
          </p>
        )}

        {view === "cards" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <button
                key={s.definition.id}
                type="button"
                onClick={() => open(s.definition.id)}
                className={`${cardClass} gap-3 p-4 text-left transition hover:border-blue-400 hover:shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-200">
                    <SymptomIcon
                      type={s.definition.icon ?? s.definition.name}
                      dict={rootDict}
                      size="h-9 w-9"
                      fixed_label={s.definition.name}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">
                      {s.definition.name}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {familyLabel(s.definition.family)}
                    </p>
                  </div>
                  <StateBadge state={s.definition.state} d={d} />
                </div>
                {s.definition.description && (
                  <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                    {s.definition.description}
                  </p>
                )}
                <VersionText s={s} d={d} />
              </button>
            ))}
          </div>
        ) : (
          <div
            className={`${cardClass} divide-y divide-gray-100 dark:divide-gray-700`}
          >
            {shown.map((s) => (
              <button
                key={s.definition.id}
                type="button"
                onClick={() => open(s.definition.id)}
                className="flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <SymptomIcon
                  type={s.definition.icon ?? s.definition.name}
                  dict={rootDict}
                  size="h-7 w-7"
                  fixed_label={s.definition.name}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">
                  {s.definition.name}
                </span>
                <span className="hidden w-48 truncate text-xs text-gray-500 md:block">
                  {familyLabel(s.definition.family)}
                </span>
                <span className="w-40">
                  <VersionText s={s} d={d} />
                </span>
                <StateBadge state={s.definition.state} d={d} />
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateSymptomModal
        open={creating}
        d={d}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          setCreating(false);
          open(created.definition.id);
        }}
      />
    </div>
  );
}
