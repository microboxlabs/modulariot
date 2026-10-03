"use client";

import { useState } from "react";
import type { Preview } from "./maintainer-api";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { insertIntoFocused } from "./cel-editor";

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
  return cached?.source === source ? cached.samples : [];
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

function leafClass(value: unknown): string {
  if (typeof value === "string") return "text-green-700 dark:text-green-400";
  if (typeof value === "number") return "text-blue-600 dark:text-blue-400";
  if (typeof value === "boolean") return "text-violet-600 dark:text-violet-400";
  return "text-gray-400";
}

function Leaf({
  name,
  path,
  value,
  notInEngine,
  readOnly,
  d,
}: Readonly<{
  name: string;
  path: string;
  value: unknown;
  notInEngine: boolean;
  readOnly: boolean;
  d: I18nRecord;
}>) {
  const text = (
    <>
      <span className="text-gray-700 dark:text-gray-300">{name}</span>
      <span className="text-gray-400"> : </span>
      <span className={leafClass(value)}>
        {JSON.stringify(value) ?? "null"}
      </span>
      {notInEngine && (
        <span className="ml-2 rounded bg-amber-50 px-1 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {tr("engineNotYetTag", d)}
        </span>
      )}
    </>
  );
  if (readOnly) return <div className="py-0.5 pl-4">{text}</div>;
  const label = tr("insertField", d, { path });
  return (
    <button
      type="button"
      draggable
      title={label}
      aria-label={label}
      className="block w-full cursor-grab rounded py-0.5 pl-4 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30"
      onClick={() => insertIntoFocused(path)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", path);
      }}
    >
      {text}
    </button>
  );
}

function Node({
  name,
  path,
  value,
  collapsed,
  notInEngine,
  readOnly,
  d,
  onToggle,
}: Readonly<{
  name: string;
  path: string;
  value: Json;
  collapsed: ReadonlySet<string>;
  notInEngine: ReadonlySet<string>;
  readOnly: boolean;
  d: I18nRecord;
  onToggle: (path: string) => void;
}>) {
  const open = !collapsed.has(path);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-1 py-0.5 font-semibold text-gray-900 dark:text-white"
        onClick={() => onToggle(path)}
      >
        <span aria-hidden className="w-3 text-[10px] text-gray-400">
          {open ? "▾" : "▸"}
        </span>
        {name}
      </button>
      {open && (
        <div className="pl-3">
          <Entries
            value={value}
            path={path}
            collapsed={collapsed}
            notInEngine={notInEngine}
            readOnly={readOnly}
            d={d}
            onToggle={onToggle}
          />
        </div>
      )}
    </div>
  );
}

function Entries({
  value,
  path,
  collapsed,
  notInEngine,
  readOnly,
  d,
  onToggle,
}: Readonly<{
  value: Json;
  path: string;
  collapsed: ReadonlySet<string>;
  notInEngine: ReadonlySet<string>;
  readOnly: boolean;
  d: I18nRecord;
  onToggle: (path: string) => void;
}>) {
  return (
    <>
      {Object.entries(value).map(([name, v]) => {
        const child = path ? `${path}.${name}` : name;
        return isObject(v) ? (
          <Node
            key={child}
            name={name}
            path={child}
            value={v}
            collapsed={collapsed}
            notInEngine={notInEngine}
            readOnly={readOnly}
            d={d}
            onToggle={onToggle}
          />
        ) : (
          <Leaf
            key={child}
            name={name}
            path={child}
            value={v}
            notInEngine={notInEngine.has(child)}
            readOnly={readOnly}
            d={d}
          />
        );
      })}
    </>
  );
}

/**
 * One sample of the source as a tree, with ‹ › to change sample. Click a field
 * to insert its path where the rule was being edited, or drag it into the rule.
 */
export default function SampleTree({
  samples,
  index,
  notInEngine = new Set(),
  readOnly,
  d,
  onIndex,
}: Readonly<{
  samples: Json[];
  index: number;
  /** Paths the engine cannot read yet; they get the "motor: aún no" tag. */
  notInEngine?: ReadonlySet<string>;
  readOnly: boolean;
  d: I18nRecord;
  onIndex: (index: number) => void;
}>) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const sample = samples[index];
  if (!sample) return null;
  const position = tr("sampleOf", d, {
    n: String(index + 1),
    total: String(samples.length),
  });
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  return (
    <div className="flex max-h-80 flex-col rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-end gap-2 border-b border-gray-200 px-2 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
        <button
          type="button"
          aria-label={tr("previousSample", d)}
          className={navClass}
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
        >
          ‹
        </button>
        <span title={position}>{sampleLabel(sample) ?? position}</span>
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
      <div className="overflow-auto p-2 font-mono text-xs">
        <Entries
          value={sample}
          path=""
          collapsed={collapsed}
          notInEngine={notInEngine}
          readOnly={readOnly}
          d={d}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}
