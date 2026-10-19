"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button, Label, Spinner, Textarea, TextInput } from "flowbite-react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineCollection,
  HiOutlineFilter,
  HiOutlineInformationCircle,
  HiOutlineViewList,
} from "react-icons/hi";
import { toast } from "sonner";
import type { IconType } from "react-icons";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import AssetPicker from "./asset-picker";
import { ShareRejectedError } from "./data-sharing-api";
import {
  checkShare,
  coveredAssets,
  facet,
  formatCount,
  formatDate,
  shareStatus,
} from "./data-sharing";
import FacetCombobox from "./facet-combobox";
import OrgCombobox from "./org-combobox";
import { useShareableAssets } from "./use-platform-data-shares";
import type {
  CreateDataShare,
  DataShare,
  DataShareAsset,
  DataShareFilter,
  DataShareOrg,
  DataShareScope,
} from "./platform.types";

interface DataShareEditorProps {
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly orgs: ReadonlyMap<string, DataShareOrg>;
  readonly shares: readonly DataShare[];
  readonly onCancel: () => void;
  readonly onCreate: (draft: CreateDataShare) => Promise<DataShare>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const SCOPES: { scope: DataShareScope; icon: IconType }[] = [
  { scope: "ALL", icon: HiOutlineCollection },
  { scope: "FILTER", icon: HiOutlineFilter },
  { scope: "ASSETS", icon: HiOutlineViewList },
];

const SAMPLE = 12;

/**
 * Creates a share. A page rather than a modal: a provider can hold thousands
 * of devices, and picking among them needs room for filters and a long list.
 */
export default function DataShareEditor({
  dict,
  lang,
  orgs,
  shares,
  onCancel,
  onCreate,
}: Readonly<DataShareEditorProps>) {
  const [sourceOrg, setSourceOrg] = useState("");
  const [targetOrg, setTargetOrg] = useState("");
  const [scope, setScope] = useState<DataShareScope>("ALL");
  const [filter, setFilter] = useState<DataShareFilter>({
    owners: [],
    kinds: [],
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [validFrom, setValidFrom] = useState(today());
  const [validTo, setValidTo] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const orgList = useMemo(
    () => [...orgs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [orgs]
  );
  const source = orgs.get(sourceOrg);
  const target = orgs.get(targetOrg);
  const { assets, isLoading: loadingAssets } = useShareableAssets(sourceOrg);

  const draft: CreateDataShare = {
    sourceOrg,
    targetOrg,
    scope,
    filter: scope === "FILTER" ? filter : null,
    assetIds: scope === "ASSETS" ? [...selected] : [],
    validFrom: new Date(`${validFrom}T00:00:00`).toISOString(),
    validTo: validTo ? new Date(`${validTo}T23:59:59`).toISOString() : null,
    note: note.trim() || null,
  };
  const problem = checkShare(draft, shares, Date.now());
  const covered = useMemo(
    () => coveredAssets({ scope, filter, assetIds: [...selected] }, assets),
    [scope, filter, selected, assets]
  );

  const pickSource = (slug: string) => {
    setSourceOrg(slug);
    setFilter({ owners: [], kinds: [] });
    setSelected(new Set());
    if (slug === targetOrg) setTargetOrg("");
  };

  const submit = async () => {
    setTried(true);
    setRejected(null);
    if (problem) return;
    setSaving(true);
    try {
      await onCreate(draft);
      toast.success(tr("form.created", dict));
      onCancel();
    } catch (err) {
      if (err instanceof ShareRejectedError) {
        setRejected(err.code);
      } else {
        toast.error(tr("form.saveError", dict));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button color="light" size="sm" onClick={onCancel}>
          <HiOutlineArrowLeft className="mr-2 h-4 w-4" />
          {tr("title", dict)}
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr("form.title", dict)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("form.subtitle", dict)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Step number={1} title={tr("form.stepOrgs", dict)}>
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
              <div>
                <Label htmlFor="share-source" className="mb-1 block">
                  {tr("form.source", dict)}
                </Label>
                <OrgCombobox
                  id="share-source"
                  orgs={orgList}
                  value={sourceOrg}
                  onChange={pickSource}
                  placeholder={tr("form.pick", dict)}
                  blockedReason={(o) =>
                    o.assetCount === 0 ? tr("picker.noOwnAssets", dict) : null
                  }
                  dict={dict}
                  lang={lang}
                />
              </div>
              <HiOutlineArrowRight className="mx-auto mb-3 hidden h-5 w-5 text-gray-400 md:block" />
              <div>
                <Label htmlFor="share-target" className="mb-1 block">
                  {tr("form.target", dict)}
                </Label>
                <OrgCombobox
                  id="share-target"
                  orgs={orgList}
                  value={targetOrg}
                  onChange={setTargetOrg}
                  placeholder={tr("form.pick", dict)}
                  blockedReason={(o) =>
                    o.slug === sourceOrg ? tr("picker.isSource", dict) : null
                  }
                  dict={dict}
                  lang={lang}
                />
              </div>
            </div>
            <ExistingShares
              shares={shares}
              sourceOrg={sourceOrg}
              targetOrg={targetOrg}
              dict={dict}
              lang={lang}
            />
          </Step>

          <Step number={2} title={tr("form.stepAssets", dict)}>
            {source && loadingAssets && <Spinner size="sm" />}
            {source && !loadingAssets && (
              <ScopeContent
                scope={scope}
                onScope={setScope}
                assets={assets}
                filter={filter}
                onFilter={setFilter}
                selected={selected}
                onSelected={setSelected}
                covered={covered}
                dict={dict}
                lang={lang}
              />
            )}
            {!source && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("form.pickSourceFirst", dict)}
              </p>
            )}
          </Step>

          <Step number={3} title={tr("form.stepValidity", dict)}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SettingsFormField
                id="share-from"
                label={tr("form.validFrom", dict)}
              >
                <TextInput
                  id="share-from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </SettingsFormField>
              <SettingsFormField id="share-to" label={tr("form.validTo", dict)}>
                <TextInput
                  id="share-to"
                  type="date"
                  value={validTo}
                  min={validFrom}
                  onChange={(e) => setValidTo(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {tr("form.validToHint", dict)}
                </p>
              </SettingsFormField>
            </div>
            <div className="mt-4">
              <SettingsFormField id="share-note" label={tr("form.note", dict)}>
                <Textarea
                  id="share-note"
                  rows={2}
                  placeholder={tr("form.notePlaceholder", dict)}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </SettingsFormField>
            </div>
          </Step>
        </div>

        <Summary
          source={source}
          target={target}
          scope={scope}
          count={covered.length}
          validFrom={draft.validFrom}
          validTo={draft.validTo}
          error={errorText(tried ? problem : null, rejected, dict)}
          saving={saving}
          onSubmit={() => void submit()}
          onCancel={onCancel}
          dict={dict}
          lang={lang}
        />
      </div>
    </div>
  );
}

function errorText(
  problem: string | null,
  rejected: string | null,
  dict: I18nRecord
) {
  const code = problem ?? rejected;
  return code ? trDynamic(`form.errors.${code}`, dict) : null;
}

function Step({
  number,
  title,
  children,
}: Readonly<{ number: number; title: string; children: ReactNode }>) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {number}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

interface ExistingSharesProps {
  readonly shares: readonly DataShare[];
  readonly sourceOrg: string;
  readonly targetOrg: string;
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** What the receiver already gets from the source, so a second share is a deliberate choice. */
function ExistingShares({
  shares,
  sourceOrg,
  targetOrg,
  dict,
  lang,
}: Readonly<ExistingSharesProps>) {
  if (!sourceOrg || !targetOrg) return null;
  const now = Date.now();
  const current = shares.filter(
    (s) =>
      s.sourceOrg === sourceOrg &&
      s.targetOrg === targetOrg &&
      ["ACTIVE", "SCHEDULED"].includes(shareStatus(s, now))
  );
  if (current.length === 0) return null;
  return (
    <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <p>
        {tr("form.alreadyShared", dict, {
          count: String(current.length),
          assets: formatCount(
            current.reduce((sum, s) => sum + s.assetCount, 0),
            lang
          ),
        })}
      </p>
    </div>
  );
}

interface ScopeContentProps {
  readonly scope: DataShareScope;
  readonly onScope: (scope: DataShareScope) => void;
  readonly assets: readonly DataShareAsset[];
  readonly filter: DataShareFilter;
  readonly onFilter: (filter: DataShareFilter) => void;
  readonly selected: ReadonlySet<string>;
  readonly onSelected: (selected: Set<string>) => void;
  readonly covered: readonly DataShareAsset[];
  readonly dict: I18nRecord;
  readonly lang: string;
}

function ScopeContent({
  scope,
  onScope,
  assets,
  filter,
  onFilter,
  selected,
  onSelected,
  covered,
  dict,
  lang,
}: Readonly<ScopeContentProps>) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <legend className="sr-only">{tr("form.scope", dict)}</legend>
        {SCOPES.map(({ scope: option, icon }) => (
          <ScopeCard
            key={option}
            scope={option}
            icon={icon}
            checked={scope === option}
            onPick={onScope}
            count={option === "ALL" ? assets.length : null}
            dict={dict}
            lang={lang}
          />
        ))}
      </fieldset>

      {scope === "ALL" && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {tr("scope.allDetail", dict, {
            count: formatCount(assets.length, lang),
          })}
        </p>
      )}
      {scope === "FILTER" && (
        <FilterScope
          assets={assets}
          filter={filter}
          onFilter={onFilter}
          covered={covered}
          dict={dict}
          lang={lang}
        />
      )}
      {scope === "ASSETS" && (
        <AssetPicker
          assets={assets}
          selected={selected}
          onChange={onSelected}
          dict={dict}
          lang={lang}
        />
      )}
    </div>
  );
}

interface ScopeCardProps {
  readonly scope: DataShareScope;
  readonly icon: IconType;
  readonly checked: boolean;
  readonly onPick: (scope: DataShareScope) => void;
  readonly count: number | null;
  readonly dict: I18nRecord;
  readonly lang: string;
}

function ScopeCard({
  scope,
  icon: Icon,
  checked,
  onPick,
  count,
  dict,
  lang,
}: Readonly<ScopeCardProps>) {
  const tone = checked
    ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-900/20"
    : "border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700";
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${tone}`}
    >
      <input
        type="radio"
        name="share-scope"
        className="sr-only"
        checked={checked}
        onChange={() => onPick(scope)}
      />
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${checked ? "text-blue-600" : "text-gray-400"}`}
      />
      <span>
        <span className="block text-sm font-medium text-gray-900 dark:text-white">
          {trDynamic(`scope.${scope}`, dict)}
          {count !== null && (
            <span className="ml-1 font-normal text-gray-500">
              ({formatCount(count, lang)})
            </span>
          )}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {trDynamic(`scope.hint.${scope}`, dict)}
        </span>
      </span>
    </label>
  );
}

interface FilterScopeProps {
  readonly assets: readonly DataShareAsset[];
  readonly filter: DataShareFilter;
  readonly onFilter: (filter: DataShareFilter) => void;
  readonly covered: readonly DataShareAsset[];
  readonly dict: I18nRecord;
  readonly lang: string;
}

function FilterScope({
  assets,
  filter,
  onFilter,
  covered,
  dict,
  lang,
}: Readonly<FilterScopeProps>) {
  const owners = useMemo(() => facet(assets, (a) => a.owner), [assets]);
  const kinds = useMemo(() => facet(assets, (a) => a.kind), [assets]);
  const hasCriteria = filter.owners.length + filter.kinds.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="filter-owners" className="mb-1 block">
            {tr("filter.owners", dict)}
          </Label>
          <FacetCombobox
            id="filter-owners"
            facets={owners}
            value={filter.owners}
            onChange={(v) => onFilter({ ...filter, owners: v })}
            placeholder={tr("picker.anyOwner", dict)}
            emptyLabel={tr("picker.noOwner", dict)}
            noResults={tr("picker.noValues", dict)}
            lang={lang}
          />
        </div>
        <div>
          <Label htmlFor="filter-kinds" className="mb-1 block">
            {tr("filter.kinds", dict)}
          </Label>
          <FacetCombobox
            id="filter-kinds"
            facets={kinds}
            value={filter.kinds}
            onChange={(v) => onFilter({ ...filter, kinds: v })}
            placeholder={tr("picker.anyKind", dict)}
            emptyLabel={tr("picker.noKind", dict)}
            noResults={tr("picker.noValues", dict)}
            lang={lang}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("filter.hint", dict)}
      </p>
      {hasCriteria && (
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {tr("filter.matches", dict, {
              count: formatCount(covered.length, lang),
              total: formatCount(assets.length, lang),
            })}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {covered.slice(0, SAMPLE).map((a) => (
              <span
                key={a.id}
                className="rounded bg-white px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {a.id}
              </span>
            ))}
            {covered.length > SAMPLE && (
              <span className="px-1 text-xs text-gray-500">
                {tr("detail.more", dict, {
                  count: formatCount(covered.length - SAMPLE, lang),
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SummaryProps {
  readonly source: DataShareOrg | undefined;
  readonly target: DataShareOrg | undefined;
  readonly scope: DataShareScope;
  readonly count: number;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly error: string | null;
  readonly saving: boolean;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
  readonly dict: I18nRecord;
  readonly lang: string;
}

function Summary({
  source,
  target,
  scope,
  count,
  validFrom,
  validTo,
  error,
  saving,
  onSubmit,
  onCancel,
  dict,
  lang,
}: Readonly<SummaryProps>) {
  const dash = "—";
  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 xl:sticky xl:top-0 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
        {tr("summary.title", dict)}
      </h3>
      <dl className="flex flex-col gap-2 text-sm">
        <SummaryRow
          label={tr("form.source", dict)}
          value={source?.name ?? dash}
        />
        <SummaryRow
          label={tr("form.target", dict)}
          value={target?.name ?? dash}
        />
        <SummaryRow
          label={tr("form.scope", dict)}
          value={trDynamic(`scope.${scope}`, dict)}
        />
        <SummaryRow
          label={tr("table.validity", dict)}
          value={`${formatDate(validFrom, lang)} – ${formatDate(validTo, lang) ?? tr("noEnd", dict)}`}
        />
      </dl>
      <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
        <p className="text-3xl font-semibold text-blue-700 dark:text-blue-300">
          {source ? formatCount(count, lang) : dash}
        </p>
        <p className="text-xs text-blue-800 dark:text-blue-200">
          {scope === "ASSETS"
            ? tr("summary.fixed", dict)
            : tr("summary.today", dict)}
        </p>
      </div>
      {target && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("form.noReshare", dict, { target: target.name })}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <Button color="blue" disabled={saving} onClick={onSubmit}>
        {tr("form.submit", dict)}
      </Button>
      <Button color="alternative" disabled={saving} onClick={onCancel}>
        {tr("form.cancel", dict)}
      </Button>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-900 dark:text-white">
        {value}
      </dd>
    </div>
  );
}
