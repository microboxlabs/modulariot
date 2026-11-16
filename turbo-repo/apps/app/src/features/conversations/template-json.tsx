"use client";

import { useState } from "react";
import { HiPlus, HiTrash } from "react-icons/hi";
import JsonCodeEditor from "@/features/common/components/json-code-editor";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { FIELD } from "@/features/symptoms/maintainer/ui/response-block";
import type {
  TeamsVariant,
  TemplateBody,
  TemplateParam,
} from "./conversations-types";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const optionalObject = (v: unknown) =>
  v === undefined || v === null || isObject(v);

/** The template as its JSON shows it: every part, in the order the editor lists them. */
export function templateJson(body: TemplateBody) {
  return {
    name: body.name,
    baseText: body.baseText,
    params: body.params ?? [],
    whatsapp: body.whatsapp,
    email: body.email,
    teams: body.teams ?? null,
  };
}

/** The template a JSON text describes, or the problem with it. */
export function readTemplateJson(
  data: unknown,
  d: I18nRecord
): { body: TemplateBody } | { error: string } {
  if (!isObject(data)) return { error: tr("tplJsonNotObject", d) };
  const { name, baseText, params, whatsapp, email, teams } = data;
  if (typeof name !== "string")
    return { error: tr("tplJsonField", d, { field: "name", type: "string" }) };
  if (
    baseText !== undefined &&
    baseText !== null &&
    typeof baseText !== "string"
  )
    return {
      error: tr("tplJsonField", d, { field: "baseText", type: "string" }),
    };
  if (params !== undefined && params !== null && !Array.isArray(params))
    return { error: tr("tplJsonField", d, { field: "params", type: "array" }) };
  for (const [field, value] of Object.entries({ whatsapp, email, teams }))
    if (!optionalObject(value))
      return { error: tr("tplJsonField", d, { field, type: "object" }) };
  const list = (params ?? []) as unknown[];
  if (!list.every((p) => isObject(p) && typeof p.name === "string"))
    return { error: tr("tplJsonParam", d) };
  return {
    body: {
      name,
      baseText: (baseText as string | null) ?? "",
      params: list as TemplateParam[],
      whatsapp: (whatsapp ?? null) as TemplateBody["whatsapp"],
      email: (email ?? null) as TemplateBody["email"],
      teams: (teams ?? null) as TeamsVariant | null,
    },
  };
}

/**
 * The whole template as JSON: name, texts, parameters and every channel's variant, the Teams card included.
 * An edit that reads as a template goes to `onChange`; anything else is shown and kept out of the template.
 */
export function TemplateJsonEditor({
  body,
  readOnly,
  d,
  onChange,
  onBroken,
}: Readonly<{
  body: TemplateBody;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (body: TemplateBody) => void;
  onBroken: (broken: boolean) => void;
}>) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <JsonCodeEditor
        value={templateJson(body)}
        readOnly={readOnly}
        ariaLabel={tr("tplJsonLabel", d)}
        parseError={tr("jsonInvalid", d)}
        onChange={(data) => {
          if (data === null) {
            setError(null);
            onBroken(true);
            return;
          }
          const read = readTemplateJson(data, d);
          if ("error" in read) {
            setError(read.error);
            onBroken(true);
            return;
          }
          setError(null);
          onBroken(false);
          onChange(read.body);
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <p className={`text-xs ${MUTED}`}>{tr("tplJsonHint", d)}</p>
    </div>
  );
}

/** A Teams card to start from: the title and the text, for the step's values or the event's variables. */
export const NEW_TEAMS_CARD: TeamsVariant = {
  title: "",
  text: "",
  facts: [],
  notes: [],
  actions: [],
};

/** The Teams card as JSON; an edit that is an object goes to `onChange`. */
export function TeamsCardJson({
  card,
  readOnly,
  d,
  onChange,
  onBroken,
}: Readonly<{
  card: TeamsVariant;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (card: TeamsVariant) => void;
  onBroken: (broken: boolean) => void;
}>) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <JsonCodeEditor
        value={card}
        readOnly={readOnly}
        ariaLabel={tr("tplTeamsJsonLabel", d)}
        parseError={tr("jsonInvalid", d)}
        onChange={(data) => {
          if (data === null) {
            setError(null);
            onBroken(true);
            return;
          }
          if (!isObject(data)) {
            setError(tr("tplJsonNotObject", d));
            onBroken(true);
            return;
          }
          setError(null);
          onBroken(false);
          onChange(data as TeamsVariant);
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <p className={`text-xs ${MUTED}`}>{tr("tplTeamsJsonHint", d)}</p>
    </div>
  );
}

/** The template's parameters: the values each rule step that uses it writes. */
export function TemplateParamsEditor({
  params,
  readOnly,
  d,
  onChange,
}: Readonly<{
  params: TemplateParam[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (params: TemplateParam[]) => void;
}>) {
  const set = (i: number, patch: Partial<TemplateParam>) =>
    onChange(params.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="flex flex-col gap-2">
      {params.length === 0 && (
        <p className={`text-sm ${MUTED}`}>{tr("tplParamsNone", d)}</p>
      )}
      {params.map((p, i) => (
        // The name changes while typing, so the row is keyed by position.
        <div
          key={i}
          className="grid grid-cols-1 items-center gap-2 md:grid-cols-[12rem_1fr_auto_auto]"
        >
          <input
            aria-label={tr("tplParamName", d)}
            placeholder={tr("tplParamName", d)}
            className={`${FIELD} font-mono`}
            disabled={readOnly}
            value={p.name}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <input
            aria-label={tr("tplParamLabel", d)}
            placeholder={tr("tplParamLabel", d)}
            className={FIELD}
            disabled={readOnly}
            value={p.label ?? ""}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={Boolean(p.multiline)}
              onChange={(e) => set(i, { multiline: e.target.checked })}
            />
            {tr("tplParamMultiline", d)}
          </label>
          {!readOnly && (
            <button
              type="button"
              aria-label={tr("tplParamRemove", d)}
              className="text-gray-400 hover:text-red-500"
              onClick={() => onChange(params.filter((_, j) => j !== i))}
            >
              <HiTrash className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1.5 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange([...params, { name: "", label: "", multiline: false }])
          }
        >
          <HiPlus aria-hidden className="h-4 w-4" />
          {tr("tplParamAdd", d)}
        </button>
      )}
      <p className={`text-xs ${MUTED}`}>{tr("tplParamsHint", d)}</p>
    </div>
  );
}
