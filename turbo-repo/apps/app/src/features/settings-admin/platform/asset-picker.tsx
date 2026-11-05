"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button, Textarea, TextInput, ToggleSwitch } from "flowbite-react";
import { HiOutlineClipboardList, HiOutlineSearch } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  facet,
  formatCount,
  matchesFilter,
  matchPasted,
  type PasteResult,
} from "./data-sharing";
import FacetCombobox from "./facet-combobox";
import type { DataShareAsset } from "./platform.types";

interface AssetPickerProps {
  readonly assets: readonly DataShareAsset[];
  readonly selected: ReadonlySet<string>;
  readonly onChange: (selected: Set<string>) => void;
  readonly dict: I18nRecord;
  readonly lang: string;
}

const ROW_HEIGHT = 40;
const GRID =
  "grid grid-cols-[2.5rem_minmax(9rem,1.2fr)_minmax(6rem,0.8fr)_minmax(10rem,1.6fr)_minmax(7rem,0.9fr)] items-center";
const SHOWN_MISSING = 20;

export function relativeTime(iso: string | null, lang: string, now: number) {
  if (!iso) return "—";
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);
  const format = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}

/**
 * Picks a fixed list among an organization's assets, which can run into the
 * thousands: the table renders only the visible rows, filters narrow it, and a
 * pasted list selects in bulk.
 */
export default function AssetPicker({
  assets,
  selected,
  onChange,
  dict,
  lang,
}: Readonly<AssetPickerProps>) {
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [onlySelected, setOnlySelected] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteResult, setPasteResult] = useState<PasteResult | null>(null);

  useEffect(() => {
    setQuery("");
    setKinds([]);
    setOwners([]);
    setOnlySelected(false);
    setPasteResult(null);
  }, [assets]);

  const kindFacets = useMemo(() => facet(assets, (a) => a.kind), [assets]);
  const ownerFacets = useMemo(() => facet(assets, (a) => a.owner), [assets]);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (!q || a.id.toLowerCase().includes(q)) &&
        matchesFilter(a, { owners, kinds }) &&
        (!onlySelected || selected.has(a.id))
    );
  }, [assets, query, kinds, owners, onlySelected, selected]);

  const matchingSelected = useMemo(
    () => matching.filter((a) => selected.has(a.id)).length,
    [matching, selected]
  );

  const addMatching = () => {
    const next = new Set(selected);
    matching.forEach((a) => next.add(a.id));
    onChange(next);
  };
  const removeMatching = () => {
    const next = new Set(selected);
    matching.forEach((a) => next.delete(a.id));
    onChange(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };
  const applyPaste = () => {
    const result = matchPasted(pasted, assets);
    onChange(new Set([...selected, ...result.found]));
    setPasteResult(result);
    setPasted("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
        <TextInput
          sizing="md"
          icon={HiOutlineSearch}
          placeholder={tr("picker.searchAsset", dict)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <FacetCombobox
          id="picker-kinds"
          facets={kindFacets}
          value={kinds}
          onChange={setKinds}
          placeholder={tr("picker.anyKind", dict)}
          emptyLabel={tr("picker.noKind", dict)}
          noResults={tr("picker.noValues", dict)}
          lang={lang}
        />
        <FacetCombobox
          id="picker-owners"
          facets={ownerFacets}
          value={owners}
          onChange={setOwners}
          placeholder={tr("picker.anyOwner", dict)}
          emptyLabel={tr("picker.noOwner", dict)}
          noResults={tr("picker.noValues", dict)}
          lang={lang}
        />
        <Button
          color="light"
          onClick={() => setPasting((open) => !open)}
          className="whitespace-nowrap"
        >
          <HiOutlineClipboardList className="mr-2 h-4 w-4" />
          {tr("picker.paste", dict)}
        </Button>
      </div>

      {pasting && (
        <PastePanel
          value={pasted}
          onChange={setPasted}
          onApply={applyPaste}
          result={pasteResult}
          dict={dict}
          lang={lang}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700/50">
        <span className="text-gray-700 dark:text-gray-200">
          {tr("picker.status", dict, {
            matching: formatCount(matching.length, lang),
            selected: formatCount(selected.size, lang),
            total: formatCount(assets.length, lang),
          })}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleSwitch
            checked={onlySelected}
            onChange={setOnlySelected}
            label={tr("picker.onlySelected", dict)}
            sizing="sm"
          />
          <Button
            size="xs"
            color="blue"
            disabled={matching.length === matchingSelected}
            onClick={addMatching}
          >
            {tr("picker.addMatching", dict, {
              count: formatCount(matching.length - matchingSelected, lang),
            })}
          </Button>
          <Button
            size="xs"
            color="light"
            disabled={matchingSelected === 0}
            onClick={removeMatching}
          >
            {tr("picker.removeMatching", dict, {
              count: formatCount(matchingSelected, lang),
            })}
          </Button>
        </div>
      </div>

      <AssetTable
        rows={matching}
        selected={selected}
        allChecked={matching.length > 0 && matchingSelected === matching.length}
        someChecked={matchingSelected > 0}
        onToggle={toggle}
        onToggleAll={
          matchingSelected === matching.length ? removeMatching : addMatching
        }
        dict={dict}
        lang={lang}
      />
    </div>
  );
}

interface PastePanelProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onApply: () => void;
  readonly result: PasteResult | null;
  readonly dict: I18nRecord;
  readonly lang: string;
}

function PastePanel({
  value,
  onChange,
  onApply,
  result,
  dict,
  lang,
}: Readonly<PastePanelProps>) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {tr("picker.pasteHint", dict)}
      </p>
      <Textarea
        rows={4}
        className="font-mono text-xs"
        placeholder={"KTRB12\nHGJL76\n861234567890123"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        {result ? (
          <PasteSummary result={result} dict={dict} lang={lang} />
        ) : (
          <span />
        )}
        <Button
          size="sm"
          color="blue"
          disabled={!value.trim()}
          onClick={onApply}
        >
          {tr("picker.pasteApply", dict)}
        </Button>
      </div>
    </div>
  );
}

function PasteSummary({
  result,
  dict,
  lang,
}: Readonly<{ result: PasteResult; dict: I18nRecord; lang: string }>) {
  return (
    <div className="text-sm">
      <p className="text-gray-700 dark:text-gray-200">
        {tr("picker.pasteResult", dict, {
          found: formatCount(result.found.length, lang),
          missing: formatCount(result.missing.length, lang),
        })}
      </p>
      {result.missing.length > 0 && (
        <p className="mt-1 font-mono text-xs text-red-600 dark:text-red-400">
          {result.missing.slice(0, SHOWN_MISSING).join(", ")}
          {result.missing.length > SHOWN_MISSING && " …"}
        </p>
      )}
    </div>
  );
}

interface AssetTableProps {
  readonly rows: readonly DataShareAsset[];
  readonly selected: ReadonlySet<string>;
  readonly allChecked: boolean;
  readonly someChecked: boolean;
  readonly onToggle: (id: string) => void;
  readonly onToggleAll: () => void;
  readonly dict: I18nRecord;
  readonly lang: string;
}

const CHECKBOX =
  "h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700";

function AssetTable({
  rows,
  selected,
  allChecked,
  someChecked,
  onToggle,
  onToggleAll,
  dict,
  lang,
}: Readonly<AssetTableProps>) {
  const scroller = useRef<HTMLDivElement>(null);
  const headerBox = useRef<HTMLInputElement>(null);
  const now = useMemo(() => Date.now(), []);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  useEffect(() => {
    if (headerBox.current) {
      headerBox.current.indeterminate = someChecked && !allChecked;
    }
  }, [someChecked, allChecked]);

  return (
    <div className="overflow-hidden rounded-lg border-2 border-gray-300 shadow-md dark:border-gray-600">
      <div
        className={`${GRID} bg-gray-50 px-0 text-xs font-semibold uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-300`}
        style={{ height: ROW_HEIGHT }}
      >
        <span className="flex justify-center">
          <input
            ref={headerBox}
            type="checkbox"
            aria-label={tr("picker.toggleMatching", dict)}
            className={CHECKBOX}
            checked={allChecked}
            disabled={rows.length === 0}
            onChange={onToggleAll}
          />
        </span>
        <span className="px-2">{tr("picker.columns.id", dict)}</span>
        <span className="px-2">{tr("picker.columns.kind", dict)}</span>
        <span className="px-2">{tr("picker.columns.owner", dict)}</span>
        <span className="px-2">{tr("picker.columns.lastSeen", dict)}</span>
      </div>
      <div
        ref={scroller}
        className="h-[26rem] overflow-y-auto bg-white dark:bg-gray-800"
      >
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {tr("picker.noAssets", dict)}
          </p>
        )}
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const asset = rows[item.index];
            if (!asset) return null;
            return (
              <AssetRow
                key={asset.id}
                asset={asset}
                top={item.start}
                checked={selected.has(asset.id)}
                onToggle={onToggle}
                noOwner={tr("picker.noOwner", dict)}
                lastSeen={relativeTime(asset.lastSeen, lang, now)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface AssetRowProps {
  readonly asset: DataShareAsset;
  readonly top: number;
  readonly checked: boolean;
  readonly onToggle: (id: string) => void;
  readonly noOwner: string;
  readonly lastSeen: string;
}

function AssetRow({
  asset,
  top,
  checked,
  onToggle,
  noOwner,
  lastSeen,
}: Readonly<AssetRowProps>) {
  const inputId = `asset-${asset.id}`;
  return (
    <label
      htmlFor={inputId}
      className={`${GRID} absolute left-0 w-full cursor-pointer border-b border-gray-100 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 ${checked ? "bg-blue-50/60 dark:bg-blue-900/20" : ""}`}
      style={{ height: ROW_HEIGHT, transform: `translateY(${top}px)` }}
    >
      <span className="flex justify-center">
        <input
          id={inputId}
          type="checkbox"
          className={CHECKBOX}
          checked={checked}
          onChange={() => onToggle(asset.id)}
        />
      </span>
      <span className="truncate px-2 font-mono text-xs text-gray-900 dark:text-white">
        {asset.id}
      </span>
      <span className="truncate px-2 text-gray-600 dark:text-gray-300">
        {asset.kind}
      </span>
      <span
        className={`truncate px-2 ${asset.owner ? "text-gray-600 dark:text-gray-300" : "italic text-gray-400"}`}
      >
        {asset.owner || noOwner}
      </span>
      <span className="truncate px-2 text-gray-500 dark:text-gray-400">
        {lastSeen}
      </span>
    </label>
  );
}
