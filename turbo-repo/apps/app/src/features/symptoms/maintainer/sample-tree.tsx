"use client";

import { useId, useMemo, useState } from "react";
import { FilterSearchField } from "@/features/credentials/components/filter-search-field";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { insertIntoFocused, type CelField } from "./cel-editor";
import { FIELD_CARET_MIME } from "./cel-field-drop";
import type { Preview, SourceField } from "./maintainer-api";
import { originLabel } from "./symptom-side-panels";

const navClass =
  "rounded border border-gray-300 px-1.5 text-xs disabled:opacity-40 dark:border-gray-600";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The first value under `key` anywhere in the sample, depth first. */
function find(sample: Json, key: string): unknown {
  for (const [k, v] of Object.entries(sample)) {
    if (k === key) return v;
    if (isObject(v)) {
      const inner = find(v, key);
      if (inner !== undefined) return inner;
    }
  }
  return undefined;
}

/** The paths of the fields the engine cannot read yet. */
export function unsupportedPaths(fields: SourceField[]): ReadonlySet<string> {
  return new Set(fields.filter((f) => !f.engineSupported).map((f) => f.path));
}

/**
 * The samples of the last preview made for `source`. They stay while a new
 * preview is on its way, so the tree does not blink while typing, and are
 * dropped as soon as the source changes.
 */
export function useSourceSamples(
  preview: Preview | undefined,
  source: string | null
): Preview["samples"] {
  const [cached, setCached] = useState(preview);
  if (preview && preview !== cached) setCached(preview);
  return cached && cached.source === source ? cached.samples : [];
}

/** The first sample that opens a case, so the preview starts where the rule holds; else the first. */
export function firstOpening(samples: Preview["samples"]): number {
  return Math.max(
    0,
    samples.findIndex((s) => s.activates === true)
  );
}

/** "LDKF17 · Ruta 5 Norte · 21:31": plate, route and time of the sample, when it has them. */
export function sampleLabel(sample: Json): string | null {
  const parts: string[] = [];
  for (const key of ["plate", "route"]) {
    const v = find(sample, key);
    if (typeof v === "string" && v) parts.push(v);
  }
  const at = find(sample, "received_at");
  if (typeof at === "string") {
    const time = new Date(at);
    if (!Number.isNaN(time.getTime()))
      parts.push(
        time.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** What the tree says about a field besides its sample value. */
export interface FieldInfo {
  label: string;
  description?: string | null;
  unit?: string | null;
  /** Where the value comes from, already in the reader's language. */
  origin?: string | null;
}

export type FieldInfos = ReadonlyMap<string, FieldInfo>;

/** Reuse the localized metadata already loaded for the rule editors. */
export function celFieldInfos(fields: readonly CelField[]): FieldInfos {
  return new Map(
    fields.map((f) => [
      f.path,
      { label: f.description ?? f.path, unit: f.unit, origin: f.detail },
    ])
  );
}

/** The tree's field infos from the source's fields, by path. */
export function fieldInfos(
  fields: readonly SourceField[] | undefined,
  d: I18nRecord
): FieldInfos {
  return new Map(
    (fields ?? []).map((f) => [
      f.path,
      {
        label: f.label,
        description: f.description,
        unit: f.unit,
        origin: originLabel(f.origin, d) || null,
      },
    ])
  );
}

const MARKS = /\p{Diacritic}/gu;

/** Lower case without accents, preserving positions in the NFC form of the text. */
export function fold(text: string): string {
  let out = "";
  for (const c of text.normalize("NFC")) {
    const f = c.normalize("NFD").replace(MARKS, "").toLowerCase();
    out += f.length === c.length ? f : c;
  }
  return out;
}

function leafMatches(path: string, info: FieldInfo | undefined, q: string) {
  return [path, info?.label, info?.description].some(
    (t) => !!t && fold(t).includes(q)
  );
}

/** The fields of the elements of each list, by the list's path. */
export type ListMembers = ReadonlyMap<string, readonly string[]>;

const NO_MEMBERS: ListMembers = new Map();

/**
 * The paths left by a filter: the fields whose path, label or description
 * holds `query`, and the objects above them. Null when there is no filter.
 */
export function visiblePaths(
  sample: Json,
  query: string,
  infos: FieldInfos,
  members: ListMembers = NO_MEMBERS
): ReadonlySet<string> | null {
  const q = fold(query.trim());
  if (!q) return null;
  const out = new Set<string>();
  const walk = (value: Json, prefix: string): boolean => {
    let any = false;
    for (const [name, v] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${name}` : name;
      const hit = isObject(v)
        ? walk(v, path)
        : [path, ...(members.get(path) ?? [])].some((p) =>
            leafMatches(p, infos.get(p), q)
          );
      if (hit) {
        out.add(path);
        any = true;
      }
    }
    return any;
  };
  walk(sample, "");
  return out;
}

/** `text` with the first match of the folded query marked. */
function Marked({ text, q }: Readonly<{ text: string; q: string }>) {
  const normalized = text.normalize("NFC");
  const at = q ? fold(normalized).indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {normalized.slice(0, at)}
      <mark className="rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-700/60">
        {normalized.slice(at, at + q.length)}
      </mark>
      {normalized.slice(at + q.length)}
    </>
  );
}

function leafClass(value: unknown): string {
  if (typeof value === "string") return "text-green-700 dark:text-green-400";
  if (typeof value === "number") return "text-blue-600 dark:text-blue-400";
  if (typeof value === "boolean") return "text-violet-600 dark:text-violet-400";
  return "text-gray-400";
}

interface TreeContext {
  flipped: ReadonlySet<string>;
  notInEngine: ReadonlySet<string>;
  infos: FieldInfos;
  /** The folded filter; empty without one. */
  q: string;
  /** The paths the filter leaves; null without a filter. */
  visible: ReadonlySet<string> | null;
  members: ListMembers;
  insertText: InsertText;
  readOnly: boolean;
  d: I18nRecord;
  onToggle: (path: string) => void;
}

/** What inserting a field writes, and where the caret ends inside it. */
export type InsertText = (path: string) => { text: string; caret: number };

const insertPath: InsertText = (path) => ({ text: path, caret: path.length });

function EngineWarning({
  path,
  ctx,
}: Readonly<{ path: string; ctx: TreeContext }>) {
  if (!ctx.notInEngine.has(path)) return null;
  return (
    <span className="ml-2 rounded bg-amber-50 px-1 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
      {tr("engineNotYetTag", ctx.d)}
    </span>
  );
}

/** Name and meaning of one field of a list's elements, under the list. */
function Member({
  list,
  path,
  ctx,
}: Readonly<{ list: string; path: string; ctx: TreeContext }>) {
  const info = ctx.infos.get(path);
  return (
    <span className="block pl-3 font-sans text-[11px] leading-snug text-gray-500 dark:text-gray-400">
      <span className="font-mono text-gray-700 dark:text-gray-300">
        <Marked text={path.slice(list.length + 1)} q={ctx.q} />
      </span>
      <EngineWarning path={path} ctx={ctx} />
      {info && (
        <>
          {" — "}
          <Marked text={info.label} q={ctx.q} />
        </>
      )}
    </span>
  );
}

function Leaf({
  name,
  path,
  value,
  ctx,
}: Readonly<{ name: string; path: string; value: unknown; ctx: TreeContext }>) {
  const { d, q } = ctx;
  const info = ctx.infos.get(path);
  const meta = info ? [info.unit, info.origin].filter(Boolean).join(" · ") : "";
  const text = (
    <>
      <span className="text-gray-700 dark:text-gray-300">
        <Marked text={name} q={q} />
      </span>
      {value !== undefined && (
        <>
          <span className="text-gray-400"> : </span>
          <span className={leafClass(value)}>
            {JSON.stringify(value) ?? "null"}
          </span>
        </>
      )}
      <EngineWarning path={path} ctx={ctx} />
      {info && (
        <span className="block font-sans text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          <Marked text={info.label} q={q} />
          {info.description && (
            <>
              {" — "}
              <Marked text={info.description} q={q} />
            </>
          )}
          {meta && (
            <span className="text-gray-400 dark:text-gray-500"> · {meta}</span>
          )}
        </span>
      )}
      {ctx.members.get(path)?.map((m) => (
        <Member key={m} list={path} path={m} ctx={ctx} />
      ))}
    </>
  );
  if (ctx.readOnly) return <div className="py-0.5 pl-4">{text}</div>;
  const label = tr("insertField", d, { path });
  return (
    <button
      type="button"
      draggable
      title={label}
      aria-label={label}
      className="block w-full cursor-grab rounded py-0.5 pl-4 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30"
      onClick={() => {
        const { text, caret } = ctx.insertText(path);
        if (text === path && caret === text.length) insertIntoFocused(path);
        else insertIntoFocused(text, caret);
      }}
      onDragStart={(e) => {
        const { text, caret } = ctx.insertText(path);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", text);
        e.dataTransfer.setData(FIELD_CARET_MIME, String(caret));
      }}
    >
      {text}
    </button>
  );
}

/**
 * The first top-level object starts open and the others closed; a click flips
 * that. Under a filter every object left is open.
 */
function isOpen(path: string, first: boolean, ctx: TreeContext): boolean {
  if (ctx.visible) return true;
  return (first && !path.includes(".")) !== ctx.flipped.has(path);
}

function Node({
  name,
  path,
  value,
  first,
  ctx,
}: Readonly<{
  name: string;
  path: string;
  value: Json;
  first: boolean;
  ctx: TreeContext;
}>) {
  const open = isOpen(path, first, ctx);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        disabled={!!ctx.visible}
        className="flex items-center gap-1 py-0.5 font-semibold text-gray-900 dark:text-white"
        onClick={() => ctx.onToggle(path)}
      >
        <span aria-hidden className="w-3 text-[10px] text-gray-400">
          {open ? "▾" : "▸"}
        </span>
        <Marked text={name} q={ctx.q} />
      </button>
      {open && (
        <div className="pl-3">
          <Entries value={value} path={path} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

function Entries({
  value,
  path,
  ctx,
}: Readonly<{ value: Json; path: string; ctx: TreeContext }>) {
  const entries = Object.entries(value)
    .map(([name, v]) => ({ name, v, child: path ? `${path}.${name}` : name }))
    .filter(({ child }) => !ctx.visible || ctx.visible.has(child));
  const firstObject = path
    ? undefined
    : entries.find(({ v }) => isObject(v))?.child;
  return (
    <>
      {entries.map(({ name, v, child }) =>
        isObject(v) ? (
          <Node
            key={child}
            name={name}
            path={child}
            value={v}
            first={child === firstObject}
            ctx={ctx}
          />
        ) : (
          <Leaf key={child} name={name} path={child} value={v} ctx={ctx} />
        )
      )}
    </>
  );
}

/**
 * One sample of the source as a tree, with ‹ › to change sample and a filter
 * over the fields' paths, labels and descriptions. The first object starts
 * open, the rest closed. Click a field to insert its path where the rule was
 * being edited, or drag it into the rule.
 */
export default function SampleTree({
  samples,
  labels,
  index,
  notInEngine = new Set(),
  fields,
  members = NO_MEMBERS,
  insertText = insertPath,
  layout = "row",
  readOnly,
  d,
  onIndex,
}: Readonly<{
  samples: Json[];
  /** A name for each sample, in place of the one read from its fields. */
  labels?: string[];
  index: number;
  /** Paths the engine cannot read yet; they get the "motor: aún no" tag. */
  notInEngine?: ReadonlySet<string>;
  /** Label, description, unit and origin of each field, by path. */
  fields?: FieldInfos;
  /** The fields of each list's elements, shown under the list. */
  members?: ListMembers;
  /** What a click or a drag inserts for a field; its path by default. */
  insertText?: InsertText;
  /** "row" fills the grid row beside a rule; "panel" has its own height and scrolls inside. */
  layout?: "row" | "panel";
  readOnly: boolean;
  d: I18nRecord;
  onIndex: (index: number) => void;
}>) {
  const filterId = useId();
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const infos = useMemo<FieldInfos>(() => fields ?? new Map(), [fields]);
  const sample = samples[index];
  if (!sample) return null;
  // held_s is not a field of the source: the engine computes it per level, so it is shown, not inserted.
  const { held_s: held, ...rest } = sample;
  const visible = visiblePaths(rest, query, infos, members);
  const position = tr("sampleOf", d, {
    n: String(index + 1),
    total: String(samples.length),
  });
  const toggle = (path: string) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const ctx: TreeContext = {
    flipped,
    notInEngine,
    infos,
    q: fold(query.trim()),
    visible,
    members,
    insertText,
    readOnly,
    d,
    onToggle: toggle,
  };
  // On wide screens the tree fills its grid row, sized by the rule beside it, and scrolls inside.
  return (
    <div className={layout === "row" ? "relative lg:min-h-80" : undefined}>
      <div
        className={`flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 ${layout === "row" ? "max-h-80 lg:absolute lg:inset-0 lg:max-h-none" : "max-h-[32rem]"}`}
      >
        <div className="flex items-center justify-end gap-2 border-b border-gray-200 px-2 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {typeof held === "number" && (
            <span
              className="mr-auto rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800"
              title={tr("sampleHeldHelp", d)}
            >
              {tr("sampleHeld", d, { seconds: String(held) })}
            </span>
          )}
          <button
            type="button"
            aria-label={tr("previousSample", d)}
            className={navClass}
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            ‹
          </button>
          <span title={position}>
            {labels?.[index] ?? sampleLabel(sample) ?? position}
          </span>
          <button
            type="button"
            aria-label={tr("nextSample", d)}
            className={navClass}
            disabled={index === samples.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            ›
          </button>
        </div>
        <div className="border-b border-gray-200 px-2 py-1.5 dark:border-gray-700">
          <FilterSearchField
            id={filterId}
            value={query}
            onChange={setQuery}
            placeholder={tr("fieldFilter", d)}
            clearLabel={tr("clearFieldFilter", d)}
            className="w-full"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-xs">
          {visible?.size === 0 ? (
            <p className="py-3 text-center font-sans text-gray-500 dark:text-gray-400">
              {tr("noFieldMatches", d)}
            </p>
          ) : (
            <Entries value={rest} path="" ctx={ctx} />
          )}
        </div>
      </div>
    </div>
  );
}
