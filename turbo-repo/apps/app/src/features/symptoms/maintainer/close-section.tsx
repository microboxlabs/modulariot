"use client";

import { useState, type ReactNode } from "react";
import { HiPlus, HiTrash } from "react-icons/hi";
import SortableRows from "@/features/common/components/sortable-rows";
import { useRowKeys } from "@/features/conversations/row-keys";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  useCaseTimeline,
  useScriptSamples,
  type CaseTimelineEntry,
} from "@/features/symptoms/control-tower/control-tower-api";
import { EventTypeInput } from "./activation-form";
import CelEditor, { type CelField, type CelProblem } from "./cel-editor";
import {
  closeFields,
  type CloseFields,
  type CloseKind,
  type CloseRow,
  type CloseWhen,
  compileCloseRows,
  compileNoteRows,
  type NoteRow,
  parseCloseRows,
  parseNoteRows,
} from "./close-form";
import { moveRow } from "./condition-form";
import { Problems } from "./rule-problems";
import SampleTree, { type FieldInfos } from "./sample-tree";
import { PillNumber, PillSelect } from "./ui/pill";
import Select from "./ui/select";

/**
 * The symptom's close and note rules, the same at every level: shown under
 * "Cierre" so whoever sets up the response decides when a case ends and which
 * GPS events go in its timeline.
 */
export interface LifecycleRules {
  close: string;
  note: string;
  fields: CelField[];
  closeProblems: CelProblem[];
  noteProblems: CelProblem[];
  /** The rule's sample case moments, for the { } mode's tree. */
  samples?: { sample: Record<string, unknown>; label: string }[];
  /** What the tree says about each field of the case moments. */
  sampleFields?: FieldInfos;
  onChange: (rules: { close: string; note: string | null }) => void;
}

const LABEL =
  "text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";
const ROW =
  "flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
const TRASH = "ml-auto text-gray-400 hover:text-red-500";
const ADD =
  "flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400";

/** The close kinds the source can say: the event and trip ones need its fields. */
function kindsFor(fields: CloseFields): CloseKind[] {
  const kinds: CloseKind[] = ["operator", "normal", "age"];
  if (fields.tripActive) kinds.push("tripInactive");
  if (fields.events) kinds.push("event");
  return kinds;
}

function newWhen(kind: CloseKind, fields: CloseFields): CloseWhen {
  switch (kind) {
    case "operator":
      return { kind };
    case "normal":
      return { kind, minutes: 0 };
    case "age":
      return { kind, hours: 12 };
    case "tripInactive":
      return { kind, path: fields.tripActive ?? "" };
    case "event":
      return { kind, path: fields.events ?? "", eventType: "" };
  }
}

function SectionLabel({ text, d }: Readonly<{ text: string; d: I18nRecord }>) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={LABEL}>{text}</span>
      <span className="text-xs text-gray-400">· {tr("allLevels", d)}</span>
    </div>
  );
}

function AgeValue({
  when,
  readOnly,
  d,
  onChange,
}: Readonly<{
  when: Extract<CloseWhen, { kind: "age" }>;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (when: CloseWhen) => void;
}>) {
  const [draft, setDraft] = useState<number | null>(when.hours);
  const [previous, setPrevious] = useState(when.hours);
  if (previous !== when.hours) {
    setPrevious(when.hours);
    setDraft(when.hours);
  }
  return (
    <PillNumber
      ariaLabel={tr("closeKind.age", d)}
      disabled={readOnly}
      value={draft}
      step="any"
      unit="h"
      onChange={(value) => {
        setDraft(value);
        if (value !== null && value > 0) onChange({ ...when, hours: value });
      }}
      onBlur={() => setDraft(when.hours)}
    />
  );
}

function WhenValue({
  when,
  readOnly,
  d,
  onChange,
}: Readonly<{
  when: CloseWhen;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (when: CloseWhen) => void;
}>) {
  if (when.kind === "normal")
    return (
      <PillNumber
        ariaLabel={tr("closeKind.normal", d)}
        disabled={readOnly}
        value={when.minutes}
        unit="min"
        onChange={(v) => onChange({ ...when, minutes: Math.max(0, v ?? 0) })}
      />
    );
  if (when.kind === "age")
    return (
      <AgeValue when={when} readOnly={readOnly} d={d} onChange={onChange} />
    );
  if (when.kind === "event")
    return (
      <EventTypeInput
        value={when.eventType}
        readOnly={readOnly}
        d={d}
        onChange={(eventType) => onChange({ ...when, eventType })}
      />
    );
  return null;
}

function CloseRowItem({
  row,
  fields,
  handle,
  readOnly,
  d,
  onChange,
  onRemove,
}: Readonly<{
  row: CloseRow;
  fields: CloseFields;
  handle: ReactNode;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (row: CloseRow) => void;
  onRemove: () => void;
}>) {
  return (
    <div className={ROW}>
      {handle}
      <PillSelect
        ariaLabel={tr("closeKindLabel", d)}
        disabled={readOnly}
        value={row.when.kind}
        onChange={(kind) =>
          onChange({ ...row, when: newWhen(kind as CloseKind, fields) })
        }
        options={kindsFor(fields).map((k) => ({
          value: k,
          label: trDynamic(`closeKind.${k}`, d),
        }))}
      />
      <WhenValue
        when={row.when}
        readOnly={readOnly}
        d={d}
        onChange={(when) => onChange({ ...row, when })}
      />
      <PillSelect
        ariaLabel={tr("closeLevelLabel", d)}
        disabled={readOnly}
        value={row.maxLevel === null ? "" : String(row.maxLevel)}
        onChange={(v) => onChange({ ...row, maxLevel: v ? Number(v) : null })}
        options={[
          { value: "", label: tr("levelAny", d) },
          ...[1, 2, 3].map((n) => ({
            value: String(n),
            label: tr("levelAtMost", d, {
              level: trDynamic(`levelName${n}`, d),
            }),
          })),
        ]}
      />
      {!readOnly && (
        <button
          type="button"
          aria-label={tr("removeCloseRow", d)}
          className={TRASH}
          onClick={onRemove}
        >
          <HiTrash className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function CloseRows({
  rows,
  fields,
  readOnly,
  d,
  onChange,
}: Readonly<{
  rows: CloseRow[];
  fields: CloseFields;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (rows: CloseRow[]) => void;
}>) {
  const keys = useRowKeys(rows.length);
  return (
    <div className="flex flex-col gap-1.5">
      {rows.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("closeNever", d)}
        </p>
      )}
      <SortableRows
        items={rows}
        keys={keys.keys}
        readOnly={readOnly}
        handleLabel={tr("dragCondition", d)}
        rowClassName="rounded-lg"
        rowTestId="close-row"
        onMove={(from, to) => onChange(moveRow(rows, from, to))}
        renderRow={(row, i, handle) => (
          <CloseRowItem
            row={row}
            fields={fields}
            handle={handle}
            readOnly={readOnly}
            d={d}
            onChange={(next) =>
              onChange(rows.map((r, j) => (j === i ? next : r)))
            }
            onRemove={() => {
              keys.remove(i);
              onChange(rows.filter((_, j) => j !== i));
            }}
          />
        )}
      />
      {!readOnly && (
        <button
          type="button"
          className={ADD}
          onClick={() =>
            onChange([
              ...rows,
              { when: newWhen("operator", fields), maxLevel: null },
            ])
          }
        >
          <HiPlus className="h-4 w-4" />
          {tr("addCloseRow", d)}
        </button>
      )}
    </div>
  );
}

function NoteRows({
  rows,
  events,
  readOnly,
  d,
  onChange,
}: Readonly<{
  rows: NoteRow[];
  /** The source's event list; null when it has none. */
  events: string | null;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (rows: NoteRow[]) => void;
}>) {
  const keys = useRowKeys(rows.length);
  if (!events && rows.length === 0)
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("noteNoEvents", d)}
      </p>
    );
  return (
    <div className="flex flex-col gap-1.5">
      {rows.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noteNone", d)}
        </p>
      )}
      <SortableRows
        items={rows}
        keys={keys.keys}
        readOnly={readOnly}
        handleLabel={tr("dragCondition", d)}
        rowClassName="rounded-lg"
        rowTestId="note-row"
        onMove={(from, to) => onChange(moveRow(rows, from, to))}
        renderRow={(row, i, handle) => (
          <div className={ROW}>
            {handle}
            <span>{tr("noteKind", d)}</span>
            <EventTypeInput
              value={row.eventType}
              readOnly={readOnly}
              d={d}
              onChange={(eventType) =>
                onChange(
                  rows.map((r, j) => (j === i ? { ...r, eventType } : r))
                )
              }
            />
            {!readOnly && (
              <button
                type="button"
                aria-label={tr("removeNoteRow", d)}
                className={TRASH}
                onClick={() => {
                  keys.remove(i);
                  onChange(rows.filter((_, j) => j !== i));
                }}
              >
                <HiTrash className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      />
      {!readOnly && events && (
        <button
          type="button"
          className={ADD}
          onClick={() => onChange([...rows, { path: events, eventType: "" }])}
        >
          <HiPlus className="h-4 w-4" />
          {tr("addNoteRow", d)}
        </button>
      )}
    </div>
  );
}

function CannotShow({
  d,
  onExpr,
}: Readonly<{ d: I18nRecord; onExpr: () => void }>) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
      {tr("lifeCannotShow", d)}{" "}
      <button type="button" className="font-medium underline" onClick={onExpr}>
        {tr("editAsExpression", d)}
      </button>
    </div>
  );
}

/** The close and note rules as rows, or as CEL beside the rule's sample tree. */
export function CloseRules({
  rules,
  mode,
  readOnly,
  d,
  onExpr,
}: Readonly<{
  rules: LifecycleRules;
  mode: "form" | "expr";
  readOnly: boolean;
  d: I18nRecord;
  /** Switches the section to { } mode. */
  onExpr: () => void;
}>) {
  const fields = closeFields(rules.fields.map((f) => f.path));
  const closeRows = parseCloseRows(rules.close, fields);
  const noteRows = parseNoteRows(rules.note);
  const [index, setIndex] = useState(0);
  const samples = rules.samples ?? [];
  const setClose = (close: string) =>
    rules.onChange({ close, note: rules.note || null });
  const setNote = (note: string) =>
    rules.onChange({ close: rules.close, note: note || null });

  if (mode === "expr")
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {samples.length > 0 ? (
          <SampleTree
            samples={samples.map((s) => s.sample)}
            labels={samples.map((s) => s.label)}
            index={Math.min(index, samples.length - 1)}
            fields={rules.sampleFields}
            readOnly={readOnly}
            d={d}
            onIndex={setIndex}
          />
        ) : (
          // Holds the tree's column until the first preview comes, so the editors keep their width.
          <div
            aria-hidden
            className="min-h-40 animate-pulse rounded-lg border border-gray-200 bg-gray-50 lg:min-h-80 dark:border-gray-700 dark:bg-gray-800/40"
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <SectionLabel text={tr("closesCelLabel", d)} d={d} />
          <CelEditor
            singleLine
            readOnly={readOnly}
            ariaLabel={tr("closesCelLabel", d)}
            value={rules.close}
            fields={rules.fields}
            problems={rules.closeProblems}
            onChange={setClose}
          />
          <Problems items={rules.closeProblems} />
          <SectionLabel text={tr("notesCelLabel", d)} d={d} />
          <CelEditor
            singleLine
            readOnly={readOnly}
            ariaLabel={tr("notesCelLabel", d)}
            placeholder={tr("notesCelPlaceholder", d)}
            value={rules.note}
            fields={rules.fields}
            problems={rules.noteProblems}
            onChange={setNote}
          />
          <Problems items={rules.noteProblems} />
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <SectionLabel text={tr("closeAutoTitle", d)} d={d} />
        {closeRows ? (
          <CloseRows
            rows={closeRows}
            fields={fields}
            readOnly={readOnly}
            d={d}
            onChange={(rows) => setClose(compileCloseRows(rows))}
          />
        ) : (
          <CannotShow d={d} onExpr={onExpr} />
        )}
        <Problems items={rules.closeProblems} />
      </div>
      <div className="flex flex-col gap-2">
        <SectionLabel text={tr("noteTitle", d)} d={d} />
        {noteRows ? (
          <NoteRows
            rows={noteRows}
            events={fields.events}
            readOnly={readOnly}
            d={d}
            onChange={(rows) => setNote(compileNoteRows(rows))}
          />
        ) : (
          <CannotShow d={d} onExpr={onExpr} />
        )}
        <Problems items={rules.noteProblems} />
      </div>
    </div>
  );
}

const MARK: Record<CaseTimelineEntry["kind"], string> = {
  OPENED: "●",
  LEVEL_CHANGED: "▲",
  NOTED: "◆",
  HELD: "⏸",
  ACTION: "☎",
  CLOSED: "■",
};

function entryText(e: CaseTimelineEntry, d: I18nRecord): string {
  const level = (n: number | undefined) =>
    n === undefined ? "" : trDynamic(`levelName${n}`, d);
  switch (e.kind) {
    case "OPENED":
      return tr("timeline.OPENED", d, { level: level(e.level) });
    case "LEVEL_CHANGED":
      return tr("timeline.LEVEL_CHANGED", d, { level: level(e.level) });
    case "NOTED":
      return tr("timeline.NOTED", d, {
        event: e.description || e.eventType || "",
      });
    case "HELD":
      return tr("timeline.HELD", d, { by: e.by ?? "" });
    case "ACTION":
      return [
        trDynamic(`timelineAction.${e.action}`, d),
        e.contact,
        e.outcome,
        e.by,
      ]
        .filter(Boolean)
        .join(" · ");
    case "CLOSED":
      return tr("timeline.CLOSED", d);
  }
}

/** Which rule wrote an entry, when one did. */
function ruleOf(e: CaseTimelineEntry, d: I18nRecord): string | null {
  if (e.kind === "NOTED") return tr("fromNoteRule", d);
  if (e.kind === "CLOSED" && e.context != null) return tr("fromCloseRule", d);
  return null;
}

function time(at: string, lang: string): string {
  return new Date(at).toLocaleString(lang, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineNotice({
  sampleFailed,
  entriesFailed,
  empty,
  onRetry,
  d,
}: Readonly<{
  sampleFailed: boolean;
  entriesFailed: boolean;
  empty: boolean;
  onRetry: () => void;
  d: I18nRecord;
}>) {
  let message = tr("timelineHint", d);
  if (empty) message = tr("timelineNone", d);
  if (entriesFailed) message = tr("timelineEntriesError", d);
  if (sampleFailed) message = tr("timelineSamplesError", d);
  const failed = sampleFailed || entriesFailed;
  return (
    <p
      role={failed ? "alert" : undefined}
      className="text-xs text-gray-500 dark:text-gray-400"
    >
      {message}
      {failed && (
        <button type="button" className="ml-2 underline" onClick={onRetry}>
          {tr("scriptRetrySamples", d)}
        </button>
      )}
    </p>
  );
}

/**
 * A real case of the symptom as its timeline reads, so the close and note
 * rules can be checked against what happened. The entries came from the rules
 * published at the time, which the hint says.
 */
export function CaseTimelinePreview({
  symptomName,
  icu,
  lang = "es",
  d,
}: Readonly<{
  symptomName: string;
  icu: number;
  lang?: string;
  d: I18nRecord;
}>) {
  const {
    data: samples,
    error: sampleError,
    mutate: refreshSamples,
  } = useScriptSamples(symptomName, icu);
  const [picked, setPicked] = useState(0);
  const sample = samples?.[Math.min(picked, (samples?.length ?? 1) - 1)];
  const {
    data: entries,
    error: entriesError,
    mutate: refreshEntries,
  } = useCaseTimeline(sample?.symptom_id);
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>{tr("timelineTitle", d)}</span>
        {samples && samples.length > 0 && (
          <Select
            aria-label={tr("timelineSample", d)}
            className="ml-auto rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            value={String(Math.min(picked, samples.length - 1))}
            onChange={(e) => setPicked(Number(e.target.value))}
          >
            {samples.map((s, i) => (
              <option key={s.symptom_id} value={String(i)}>
                {`${s.symptom_id} · ${s.asset_id} · ${time(s.opened_at, lang)}`}
              </option>
            ))}
          </Select>
        )}
      </div>
      <TimelineNotice
        sampleFailed={Boolean(sampleError)}
        entriesFailed={Boolean(entriesError)}
        empty={samples?.length === 0}
        onRetry={() => void (sampleError ? refreshSamples() : refreshEntries())}
        d={d}
      />
      {entries && entries.length > 0 && (
        <ol aria-label={tr("timelineTitle", d)} className="flex flex-col gap-1">
          {entries.map((e, i) => {
            const rule = ruleOf(e, d);
            return (
              <li
                key={`${e.kind}-${e.at}-${i}`}
                className="flex items-baseline gap-2 text-sm text-gray-800 dark:text-gray-100"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-gray-500">
                  {time(e.at, lang)}
                </span>
                <span aria-hidden className="w-4 text-center text-gray-500">
                  {MARK[e.kind]}
                </span>
                <span className="min-w-0 flex-1">{entryText(e, d)}</span>
                {rule && (
                  <span className="shrink-0 rounded bg-blue-50 px-1.5 text-[11px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {rule}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
