"use client";

import { useState } from "react";
import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import CelEditor, {
  type CelField,
} from "@/features/symptoms/maintainer/cel-editor";
import type { EditMode } from "@/features/symptoms/maintainer/level-row";
import ModeToggle from "@/features/symptoms/maintainer/ui/mode-toggle";
import { FIELD } from "@/features/symptoms/maintainer/ui/response-block";
import Select from "@/features/symptoms/maintainer/ui/select";
import {
  CLAUSE_KINDS,
  compileClauses,
  newClause,
  parseClauses,
  type ContactClause,
  type ContactClauseKind,
} from "./contact-condition";
import type { EventField } from "./conversations-types";

const ICON =
  "rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400";

/** The contact fields and the event's data fields a condition can read. */
export function contactCelFields(fields: EventField[]): CelField[] {
  return [
    { path: "contact.name", detail: "string" },
    { path: "contact.role", detail: "string" },
    { path: "contact.tags", detail: "list" },
    { path: "contact.company", detail: "string" },
    { path: "contact.companyRut", detail: "string" },
    { path: "contact.position", detail: "string" },
    { path: "contact.email", detail: "string" },
    { path: "contact.whatsapp", detail: "string" },
    ...fields.map((f) => ({
      path: `event.data.${f.name}`,
      detail: [f.type, f.label].filter(Boolean).join(" · "),
    })),
  ];
}

function ClauseRow({
  clause,
  fields,
  readOnly,
  d,
  onChange,
  onRemove,
}: Readonly<{
  clause: ContactClause;
  fields: EventField[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (clause: ContactClause) => void;
  onRemove: () => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={tr("contactClauseKind", d)}
        className={FIELD}
        disabled={readOnly}
        value={clause.kind}
        onChange={(e) =>
          onChange(newClause(e.target.value as ContactClauseKind))
        }
      >
        {CLAUSE_KINDS.map((k) => (
          <option key={k} value={k}>
            {trDynamic(`contactClause.${k}`, d)}
          </option>
        ))}
      </Select>
      {clause.kind === "companyRutIs" ? (
        <Select
          aria-label={tr("contactClauseField", d)}
          className={`${FIELD} font-mono`}
          wrapperClassName="min-w-44"
          disabled={readOnly}
          value={clause.field}
          onChange={(e) => onChange({ ...clause, field: e.target.value })}
        >
          {!fields.some((f) => f.name === clause.field) && (
            <option value={clause.field}>{clause.field}</option>
          )}
          {fields.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name} · {f.label}
            </option>
          ))}
        </Select>
      ) : (
        <input
          aria-label={tr("contactClauseValue", d)}
          className={`${FIELD} min-w-40 flex-1`}
          disabled={readOnly}
          placeholder={trDynamic(`contactClausePlaceholder.${clause.kind}`, d)}
          value={clause.value}
          onChange={(e) => onChange({ ...clause, value: e.target.value })}
        />
      )}
      {!readOnly && (
        <button
          type="button"
          aria-label={tr("removeContactClause", d)}
          className={ICON}
          onClick={onRemove}
        >
          <HiX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * The condition of a "from the contact book" recipient: clauses that all
 * must hold, or CEL over `contact` and `event`.
 */
export default function ContactsAudience({
  condition,
  fields,
  readOnly,
  d,
  onChange,
}: Readonly<{
  condition: string;
  fields: EventField[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (condition: string) => void;
}>) {
  const clauses = parseClauses(condition);
  const [mode, setMode] = useState<EditMode>(clauses ? "form" : "expr");
  const setClauses = (next: ContactClause[]) => onChange(compileClauses(next));

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr("contactsHint", d)}
        </span>
        <ModeToggle mode={mode} d={d} onChange={setMode} />
      </div>
      {mode === "form" && clauses && (
        <>
          {clauses.map((c, i) => (
            <ClauseRow
              key={`${i}-${c.kind}`}
              clause={c}
              fields={fields}
              readOnly={readOnly}
              d={d}
              onChange={(next) =>
                setClauses(clauses.map((x, j) => (j === i ? next : x)))
              }
              onRemove={() => setClauses(clauses.filter((_, j) => j !== i))}
            />
          ))}
          {!readOnly && (
            <button
              type="button"
              className="flex items-center gap-1 self-start text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => setClauses([...clauses, newClause("tag")])}
            >
              <HiPlus className="h-3.5 w-3.5" />
              {tr("addContactClause", d)}
            </button>
          )}
        </>
      )}
      {mode === "form" && !clauses && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {tr("formCannotShow", d)}{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => setMode("expr")}
          >
            {tr("editAsExpression", d)}
          </button>
        </div>
      )}
      {mode === "expr" && (
        <CelEditor
          readOnly={readOnly}
          ariaLabel={tr("contactsCel", d)}
          placeholder="'transportista' in contact.tags && contact.companyRut == event.data.carrierRut"
          value={condition}
          fields={contactCelFields(fields)}
          onChange={onChange}
        />
      )}
    </div>
  );
}
