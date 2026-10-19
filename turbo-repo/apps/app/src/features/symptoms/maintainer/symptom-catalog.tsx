"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { channelGroupLabel, SymptomCard, SymptomRow } from "./catalog-card";
import {
  type CatalogFilterKey,
  CHANNEL_GROUPS,
  channelGroups,
  reachableLevels,
  whoActsKind,
} from "./catalog-derive";
import { levelName } from "./catalog-format";
import CatalogStats from "./catalog-stats";
import CreateSymptomModal from "./create-symptom-modal";
import TeamSettingsModal from "./team-settings-modal";
import {
  importEngineRules,
  refreshSymptoms,
  useSymptomDefinitions,
  useSymptomFamilies,
  useControlTowerAccess,
  useSymptomStats,
  type SymptomSummary,
} from "./maintainer-api";
import { familyLabel, stateLabel } from "./symptom-labels";
import { MUTED, Tile } from "./ui/card";
import { FilterChip } from "./ui/filter-chip";
import { STATES } from "./ui/state";

type Filters = Record<CatalogFilterKey, string>;
type Layout = "cards" | "list";

const EMPTY: Filters = {
  family: "",
  state: "",
  level: "",
  who: "",
  channel: "",
  draft: "",
};

function passes(
  s: SymptomSummary,
  f: Filters,
  d: I18nRecord,
  family: (value: string | null) => string
) {
  const spec = s.current?.spec ?? null;
  if (f.draft && !s.hasDraft) return false;
  if (f.family && family(s.definition.family) !== f.family) return false;
  if (f.state && stateLabel(s.definition.state, d) !== f.state) return false;
  if (
    f.level &&
    !reachableLevels(spec).some((icu) => levelName(icu, d) === f.level)
  )
    return false;
  if (f.who) {
    const wanted = f.who === tr("whoOperator", d) ? "operator" : "notices";
    if (whoActsKind(spec) !== wanted) return false;
  }
  if (
    f.channel &&
    !channelGroups(spec).some((g) => channelGroupLabel(g, d) === f.channel)
  )
    return false;
  return true;
}

/** Settings › Síntomas: every symptom of the organization, with its levels, who acts and how much it fires. */
export default function SymptomCatalog({
  dict,
  rootDict,
  lang,
  harnessEnabled,
}: Readonly<{
  dict: I18nRecord;
  rootDict: I18nRecord;
  lang: string;
  harnessEnabled: boolean;
}>) {
  const d = dict?.symptomCatalog as I18nRecord;
  const router = useRouter();
  const { data, error, isLoading } = useSymptomDefinitions();
  const { data: stats } = useSymptomStats();
  const { data: families } = useSymptomFamilies();
  const { canMaintain: isOwner } = useControlTowerAccess();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [layout, setLayout] = useState<Layout>("cards");
  const [creating, setCreating] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const family = (value: string | null) => familyLabel(value, families, lang);
  const shown = all.filter((s) => passes(s, filters, d, family));
  const weekOf = useMemo(() => {
    const byId = new Map(
      (stats?.symptoms ?? []).map((x) => [x.definitionId, x.week])
    );
    // No entry: the engine credited no cases to this symptom.
    return (id: string) => byId.get(id) ?? null;
  }, [stats]);
  const open = (id: string) =>
    router.push(`/${lang}/users/settings/symptoms/${id}`);

  const filterDefs: {
    key: CatalogFilterKey;
    label: string;
    options: string[];
  }[] = [
    {
      key: "family",
      label: tr("filterFamily", d),
      options: [
        ...new Set(all.map((s) => family(s.definition.family)).filter(Boolean)),
      ],
    },
    {
      key: "state",
      label: tr("filterState", d),
      options: [...STATES].reverse().map((s) => stateLabel(s, d)),
    },
    {
      key: "level",
      label: tr("filterLevel", d),
      options: [1, 2, 3, 4].map((icu) => levelName(icu, d)),
    },
    {
      key: "who",
      label: tr("filterWho", d),
      options: [tr("whoOperator", d), tr("onlyNotices", d)],
    },
    {
      key: "channel",
      label: tr("filterChannel", d),
      options: CHANNEL_GROUPS.map((g) => channelGroupLabel(g, d)),
    },
  ];
  // Not in the prototype's bar: the Cambios card sets it, and the chip shows so it can be cleared.
  if (filters.draft) {
    filterDefs.push({
      key: "draft",
      label: tr("draft", d),
      options: [tr("withDraft", d)],
    });
  }

  const runImport = async () => {
    setImporting(true);
    try {
      const r = await importEngineRules();
      await refreshSymptoms();
      setImportNote(
        tr("importDone", d, {
          created: String(r.created.length),
          skipped: String(r.skipped),
        })
      );
    } catch (e) {
      setImportNote(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "symptomCatalog"]}
          disableLinks
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900">
        {filterDefs.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            value={filters[f.key]}
            options={f.options}
            allLabel={tr("filterAll", d)}
            onChange={(v) => setFilters({ ...filters, [f.key]: v })}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pb-10 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tile>
              <svg
                aria-hidden
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z" />
              </svg>
            </Tile>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", d)}
              </h1>
              <p className={`text-sm ${MUTED}`}>{tr("description", d)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
                {(["cards", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={layout === v}
                    onClick={() => setLayout(v)}
                    className={`rounded-md px-2.5 py-1 text-xs ${
                      layout === v
                        ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white"
                        : MUTED
                    }`}
                  >
                    {v === "cards" ? tr("viewCards", d) : tr("viewList", d)}
                  </button>
                ))}
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  ＋ {tr("newSymptom", d)}
                </button>
              )}
            </div>
          </div>

          <CatalogStats
            loading={isLoading}
            all={all}
            stats={stats}
            lang={lang}
            d={d}
            onFilter={(key, value) => setFilters({ ...filters, [key]: value })}
            onOpen={open}
            onEditTeam={isOwner ? () => setEditingTeam(true) : undefined}
          />

          <p
            role="status"
            aria-live="polite"
            className="text-sm text-gray-600 dark:text-gray-300"
          >
            {importNote}
          </p>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {tr("loadFailed", d)}
            </p>
          )}
          {!isLoading && !error && shown.length === 0 && (
            <p className={`py-10 text-center text-sm ${MUTED}`}>
              {all.length === 0 ? tr("empty", d) : tr("emptyFiltered", d)}
            </p>
          )}

          {layout === "cards" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {shown.map((s) => (
                <SymptomCard
                  key={s.definition.id}
                  s={s}
                  family={family(s.definition.family)}
                  week={weekOf(s.definition.id)}
                  lang={lang}
                  d={d}
                  rootDict={rootDict}
                  onOpen={() => open(s.definition.id)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2">{tr("colSymptom", d)}</th>
                    <th className="px-4 py-2">{tr("colScale", d)}</th>
                    <th className="px-4 py-2">{tr("filterWho", d)}</th>
                    <th className="px-4 py-2">{tr("filterState", d)}</th>
                    <th className="px-4 py-2">{tr("colVersion", d)}</th>
                    <th className="px-4 py-2 text-right">
                      {tr("colPerWeek", d)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <SymptomRow
                      key={s.definition.id}
                      s={s}
                      family={family(s.definition.family)}
                      week={weekOf(s.definition.id)}
                      lang={lang}
                      d={d}
                      rootDict={rootDict}
                      onOpen={() => open(s.definition.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingTeam && (
        <TeamSettingsModal d={d} onClose={() => setEditingTeam(false)} />
      )}
      <CreateSymptomModal
        open={creating}
        d={d}
        rootDict={rootDict}
        lang={lang}
        harnessEnabled={harnessEnabled}
        importing={importing}
        onImport={() => {
          setCreating(false);
          void runImport();
        }}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          setCreating(false);
          open(created.definition.id);
        }}
      />
    </div>
  );
}
