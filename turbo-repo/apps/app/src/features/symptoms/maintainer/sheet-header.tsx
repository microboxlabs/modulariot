"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SymptomIcon from "../components/symtom-icon";
import type {
  SymptomDefinition,
  SymptomDetail,
  SymptomFamily,
  SymptomSpec,
  SymptomState,
  SymptomTemplate,
} from "./maintainer-api";
import { canonicalFamily, familyLabel } from "./symptom-labels";
import { MUTED } from "./ui/card";
import { PillSelect } from "./ui/pill";
import { StateToggle } from "./ui/state";

const MENU_ROW =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600";

/** Where the symptom came from, for the line under its name. */
export function originText(
  def: SymptomDefinition,
  templates: readonly SymptomTemplate[] | undefined,
  d: I18nRecord,
  forkedFrom: SymptomDetail["forkedFrom"] = null
) {
  if (forkedFrom) {
    return tr("originForkOf", d, {
      name: forkedFrom.name,
      version: forkedFrom.version ?? tr("unpublished", d),
    });
  }
  if (def.templateKey) {
    const name =
      templates?.find((t) => t.key === def.templateKey)?.name ??
      def.templateKey;
    return tr("originTemplate", d, { name });
  }
  if (def.forkedFromVersionId) return tr("originFork", d);
  if (def.engineRuleId != null)
    return tr("originEngine", d, { id: String(def.engineRuleId) });
  return tr("originBlank", d);
}

/** The state a draft publishes: its own, else the symptom's; a first version starts in test. */
export function draftState(
  def: SymptomDefinition,
  spec: SymptomSpec | null
): SymptomState {
  return spec?.state ?? (def.currentVersion ? def.state : "TEST");
}

/** Family options: the organization's, plus the stored value when the list no longer has it. */
export function familyOptions(
  families: readonly SymptomFamily[] | undefined,
  value: string | null,
  lang: string
) {
  const options = (families ?? [])
    .filter((f) => !f.disabled || f.value === value)
    .map((f) => ({
      value: f.value,
      label: familyLabel(f.value, families, lang),
    }));
  if (value && !options.some((o) => o.value === value)) {
    options.unshift({ value, label: familyLabel(value, families, lang) });
  }
  if (!value) options.unshift({ value: "", label: "—" });
  return options;
}

function VersionMenu({
  label,
  canFork,
  d,
  onHistory,
  onDuplicate,
}: Readonly<{
  label: string;
  canFork: boolean;
  d: I18nRecord;
  onHistory: () => void;
  onDuplicate: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-md border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:text-gray-200"
      >
        {label} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-40 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700"
        >
          <button
            type="button"
            role="menuitem"
            className={MENU_ROW}
            onClick={() => pick(onHistory)}
          >
            ↺ {tr("versionsHistory", d)}
          </button>
          {canFork && (
            <button
              type="button"
              role="menuitem"
              className={MENU_ROW}
              onClick={() => pick(onDuplicate)}
            >
              ⑂ {tr("duplicateAsNew", d)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The top of the symptom page, as in the prototype: back, icon, name, the
 * version chip and its menu, the family and where the symptom came from, and
 * the state. Family and state are part of the draft: changing them is a
 * PATCH that takes effect when the draft is published.
 */
export default function SheetHeader({
  def,
  spec,
  canWrite,
  families,
  templates,
  forkedFrom,
  backHref,
  lang,
  d,
  rootDict,
  onChange,
  onHistory,
  onDuplicate,
}: Readonly<{
  def: SymptomDefinition;
  spec: SymptomSpec | null;
  canWrite: boolean;
  families: readonly SymptomFamily[] | undefined;
  templates: readonly SymptomTemplate[] | undefined;
  forkedFrom: SymptomDetail["forkedFrom"];
  backHref: string;
  lang: string;
  d: I18nRecord;
  rootDict: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
  onHistory: () => void;
  onDuplicate: () => void;
}>) {
  const family = canonicalFamily(spec?.family ?? def.family, families);
  const state = draftState(def, spec);
  const editable = canWrite && spec !== null;
  const version = def.currentVersion
    ? `v${def.currentVersion}`
    : tr("unpublished", d);

  return (
    <div className="flex flex-wrap items-start gap-3">
      <Link
        href={backHref}
        aria-label={tr("backToCatalog", d)}
        title={tr("backToCatalog", d)}
        className={`mt-3 text-lg leading-none ${MUTED} hover:text-gray-900 dark:hover:text-white`}
      >
        ‹
      </Link>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200">
        <SymptomIcon
          type={def.icon ?? def.name}
          dict={rootDict}
          size="h-10 w-10"
          fixed_label={def.name}
        />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {def.name}
          </h1>
          <VersionMenu
            label={version}
            canFork={canWrite && def.currentVersion !== null}
            d={d}
            onHistory={onHistory}
            onDuplicate={onDuplicate}
          />
        </div>
        <div
          className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${MUTED}`}
        >
          <span>{tr("familyWord", d)}</span>
          {editable ? (
            <PillSelect
              ariaLabel={tr("familyWord", d)}
              value={family ?? ""}
              options={familyOptions(families, family, lang)}
              changed={
                spec?.family != null &&
                family !== canonicalFamily(def.family, families)
              }
              className="!text-xs"
              onChange={(value) => {
                if (spec && (value || null) !== family) {
                  onChange({ ...spec, family: value || null });
                }
              }}
            />
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">
              {familyLabel(family, families, lang) || "—"}
            </span>
          )}
          <span>
            ·{" "}
            {families && families.length === 0
              ? tr("familyListMissing", d)
              : tr("familySource", d)}
          </span>
          <span>· {originText(def, templates, d, forkedFrom)}</span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <StateToggle
          value={state}
          d={d}
          disabled={!editable}
          changed={spec?.state != null && spec.state !== def.state}
          onChange={(next) => {
            // Picking the state already shown changes nothing, so it must not create a draft.
            if (spec && next !== state) onChange({ ...spec, state: next });
          }}
        />
      </div>
    </div>
  );
}
