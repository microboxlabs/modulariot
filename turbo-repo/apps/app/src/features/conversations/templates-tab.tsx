"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "flowbite-react";
import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { keyFrom } from "@/features/symptoms/maintainer/create-symptom-modal";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import {
  FIELD,
  FieldRow,
  ResponseBlock,
} from "@/features/symptoms/maintainer/ui/response-block";
import { StatePill } from "@/features/symptoms/maintainer/ui/state";
import { ICON_BUTTON } from "./audience-list";
import ChannelIcon from "./channel-icon";
import {
  refreshTemplates,
  saveTemplate,
  useConversationTemplates,
} from "./conversations-api";
import type { ConversationTemplate, TemplateBody } from "./conversations-types";
import { channelLabel, fillText, textVariables } from "./rule-model";
import { ruleHref } from "./rules-tab";

/** Values the preview fills a template with; no real person, phone or plate. */
export const SAMPLE_VALUES: Record<string, string> = {
  nombre: "Juan Soto",
  patente: "TEST01",
  hora: "14:05",
  sintoma: "Botón de pánico",
  nivel: "Código negro",
  ubicacion: "-33.4489,-70.6693",
};

const EMPTY: TemplateBody = {
  name: "",
  baseText: "",
  whatsapp: null,
  email: null,
};

function Filled({ text }: Readonly<{ text: string }>) {
  return (
    <>
      {fillText(text, SAMPLE_VALUES).map((p, i) => {
        const k = `${i}-${"text" in p ? p.text : p.variable}`;
        if ("text" in p) return <span key={k}>{p.text}</span>;
        return p.value === null ? (
          <span
            key={k}
            className="rounded bg-gray-200 px-1 font-mono text-xs text-gray-700 dark:bg-gray-600 dark:text-gray-200"
          >{`{{${p.variable}}}`}</span>
        ) : (
          <span key={k} className="font-medium">
            {p.value}
          </span>
        );
      })}
    </>
  );
}

/** What each channel sends, filled with sample values. */
export function TemplatePreview({
  body,
  d,
}: Readonly<{ body: TemplateBody; d: I18nRecord }>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className={`text-xs ${MUTED}`}>{tr("previewBase", d)}</span>
        <p className="whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100">
          {body.baseText ? <Filled text={body.baseText} /> : "—"}
        </p>
      </div>
      {body.whatsapp && (
        <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <ChannelIcon channel="whatsapp" size={6} />
          <p>
            {tr("previewWhatsapp", d, {
              name: body.whatsapp.metaName || "—",
              language: body.whatsapp.language || "—",
            })}
            {body.whatsapp.params.length > 0 && (
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                {body.whatsapp.params
                  .map((p) => `${p} = ${SAMPLE_VALUES[p] ?? `{{${p}}}`}`)
                  .join(" · ")}
              </span>
            )}
          </p>
        </div>
      )}
      {body.email && (
        <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <ChannelIcon channel="email" size={6} />
          <div className="min-w-0 flex-1 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="border-b border-gray-200 px-3 py-2 font-medium text-gray-900 dark:border-gray-700 dark:text-white">
              <Filled text={body.email.subject || "—"} />
            </p>
            <p className="whitespace-pre-wrap px-3 py-2">
              <Filled text={body.email.body || "—"} />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ParamsInput({
  params,
  readOnly,
  d,
  onChange,
}: Readonly<{
  params: string[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (params: string[]) => void;
}>) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim().replaceAll(/[{}\s]/g, "");
    if (name && !params.includes(name)) onChange([...params, name]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {params.map((p, i) => (
        <span
          key={p}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          {i + 1}. {p}
          {!readOnly && (
            <button
              type="button"
              aria-label={tr("removeParam", d, { name: p })}
              className={ICON_BUTTON}
              onClick={() => onChange(params.filter((x) => x !== p))}
            >
              <HiX className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          aria-label={tr("addParam", d)}
          className={`${FIELD} w-36 font-mono`}
          placeholder={tr("addParamPlaceholder", d)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      )}
    </div>
  );
}

function bodyOf(t: ConversationTemplate | null): TemplateBody {
  if (!t) return EMPTY;
  return {
    name: t.name,
    baseText: t.baseText ?? "",
    whatsapp: t.whatsapp,
    email: t.email,
  };
}

/** One template: base text, the WhatsApp and email variants, a preview and where it is used. */
export function TemplateEditor({
  template,
  readOnly,
  lang,
  d,
  onSaved,
}: Readonly<{
  /** Null for a new template. */
  template: ConversationTemplate | null;
  readOnly: boolean;
  lang: string;
  d: I18nRecord;
  onSaved: (saved: ConversationTemplate) => void;
}>) {
  const [body, setBody] = useState<TemplateBody>(() => bodyOf(template));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = template === null;
  const key = template?.key ?? keyFrom(body.name);
  const set = (patch: Partial<TemplateBody>) => setBody({ ...body, ...patch });
  const unused = textVariables(body.baseText).filter(
    (v) => !Object.hasOwn(SAMPLE_VALUES, v)
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveTemplate(key, {
        ...body,
        name: body.name.trim(),
      });
      await refreshTemplates(key);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ResponseBlock title={isNew ? tr("newTemplate", d) : body.name || key}>
        <FieldRow label={tr("templateName", d)}>
          <input
            aria-label={tr("templateName", d)}
            className={`${FIELD} min-w-48 flex-1`}
            disabled={readOnly}
            maxLength={200}
            value={body.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </FieldRow>
        <FieldRow label={tr("templateKey", d)}>
          <span className="font-mono text-gray-500 dark:text-gray-400">
            {key || "—"}
          </span>
        </FieldRow>
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          {tr("baseText", d)}
          <textarea
            rows={4}
            className={FIELD}
            disabled={readOnly}
            placeholder={tr("baseTextPlaceholder", d)}
            value={body.baseText}
            onChange={(e) => set({ baseText: e.target.value })}
          />
          <span className={`text-xs ${MUTED}`}>{tr("baseTextHint", d)}</span>
        </label>
      </ResponseBlock>

      <ResponseBlock
        title={tr("channelWhatsapp", d)}
        aside={
          !readOnly && (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              onClick={() =>
                set({
                  whatsapp: body.whatsapp
                    ? null
                    : { metaName: "", language: "es", params: [] },
                })
              }
            >
              {body.whatsapp ? tr("removeVariant", d) : tr("addVariant", d)}
            </button>
          )
        }
      >
        {body.whatsapp ? (
          <>
            <FieldRow label={tr("metaName", d)}>
              <input
                aria-label={tr("metaName", d)}
                className={`${FIELD} min-w-48 flex-1 font-mono`}
                disabled={readOnly}
                placeholder="miot_panic_check_v1"
                value={body.whatsapp.metaName}
                onChange={(e) =>
                  body.whatsapp &&
                  set({
                    whatsapp: { ...body.whatsapp, metaName: e.target.value },
                  })
                }
              />
            </FieldRow>
            <FieldRow label={tr("metaLanguage", d)}>
              <input
                aria-label={tr("metaLanguage", d)}
                className={`${FIELD} w-24 font-mono`}
                disabled={readOnly}
                value={body.whatsapp.language}
                onChange={(e) =>
                  body.whatsapp &&
                  set({
                    whatsapp: { ...body.whatsapp, language: e.target.value },
                  })
                }
              />
            </FieldRow>
            <FieldRow label={tr("metaParams", d)}>
              <ParamsInput
                params={body.whatsapp.params}
                readOnly={readOnly}
                d={d}
                onChange={(params) =>
                  body.whatsapp &&
                  set({ whatsapp: { ...body.whatsapp, params } })
                }
              />
            </FieldRow>
          </>
        ) : (
          <p className={`text-sm ${MUTED}`}>{tr("noWhatsappVariant", d)}</p>
        )}
      </ResponseBlock>

      <ResponseBlock
        title={tr("channelEmail", d)}
        aside={
          !readOnly && (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              onClick={() =>
                set({ email: body.email ? null : { subject: "", body: "" } })
              }
            >
              {body.email ? tr("removeVariant", d) : tr("addVariant", d)}
            </button>
          )
        }
      >
        {body.email ? (
          <>
            <FieldRow label={tr("emailSubject", d)}>
              <input
                aria-label={tr("emailSubject", d)}
                className={`${FIELD} min-w-48 flex-1`}
                disabled={readOnly}
                value={body.email.subject}
                onChange={(e) =>
                  body.email &&
                  set({ email: { ...body.email, subject: e.target.value } })
                }
              />
            </FieldRow>
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
              {tr("emailBody", d)}
              <textarea
                rows={5}
                className={FIELD}
                disabled={readOnly}
                value={body.email.body}
                onChange={(e) =>
                  body.email &&
                  set({ email: { ...body.email, body: e.target.value } })
                }
              />
            </label>
          </>
        ) : (
          <p className={`text-sm ${MUTED}`}>{tr("noEmailVariant", d)}</p>
        )}
      </ResponseBlock>

      <ResponseBlock title={tr("preview", d)}>
        <TemplatePreview body={body} d={d} />
        {unused.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("previewNoSample", d, { names: unused.join(", ") })}
          </p>
        )}
      </ResponseBlock>

      {!isNew && (
        <ResponseBlock title={tr("usedBy", d)}>
          {(template?.usedBy ?? []).length === 0 ? (
            <p className={`text-sm ${MUTED}`}>{tr("usedByNone", d)}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(template?.usedBy ?? []).map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <StatePill state={r.state} d={d} />
                  <Link
                    href={ruleHref(lang, r.id)}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ResponseBlock>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button
            disabled={saving || key.length < 2 || !body.name.trim()}
            onClick={() => void save()}
          >
            {saving ? tr("saving", d) : tr("saveTemplate", d)}
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Plantillas": the list beside the selected template's editor. */
export default function TemplatesTab({
  lang,
  canWrite,
  d,
}: Readonly<{ lang: string; canWrite: boolean; d: I18nRecord }>) {
  const { data: templates, error, isLoading } = useConversationTemplates();
  // A template key, "new", or null for none picked.
  const [selected, setSelected] = useState<string | null>(null);
  const picked = templates?.find((t) => t.key === selected) ?? null;
  const current = selected ?? templates?.[0]?.key ?? null;
  const shown = selected === "new" ? null : (picked ?? templates?.[0] ?? null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav
        aria-label={tr("tabTemplates", d)}
        className="flex flex-col gap-1 self-start rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
      >
        {canWrite && (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-700"
            onClick={() => setSelected("new")}
          >
            <HiPlus aria-hidden className="h-4 w-4" />
            {tr("newTemplate", d)}
          </button>
        )}
        {error && (
          <p
            role="alert"
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {tr("loadFailed", d)}
          </p>
        )}
        {isLoading && (
          <p className={`px-3 py-2 text-sm ${MUTED}`}>{tr("loading", d)}</p>
        )}
        {templates?.length === 0 && (
          <p className={`px-3 py-2 text-sm ${MUTED}`}>{tr("noTemplates", d)}</p>
        )}
        {(templates ?? []).map((t) => {
          const active = t.key === current && selected !== "new";
          return (
            <button
              key={t.key}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setSelected(t.key)}
              className={`flex flex-col gap-1 rounded-md px-3 py-2 text-left text-sm ${
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-gray-700 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              <span className="truncate font-medium">{t.name}</span>
              <span className="flex items-center gap-1">
                {t.whatsapp && (
                  <ChannelIcon
                    channel="whatsapp"
                    label={channelLabel("whatsapp", d)}
                    size={5}
                  />
                )}
                {t.email && (
                  <ChannelIcon
                    channel="email"
                    label={channelLabel("email", d)}
                    size={5}
                  />
                )}
                <span className={`ml-1 text-xs ${MUTED}`}>
                  {tr("usedByCount", d, {
                    n: String(t.usedBy?.length ?? 0),
                  })}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
      {(shown || selected === "new") && (
        <TemplateEditor
          key={selected === "new" ? "new" : shown?.key}
          template={shown}
          readOnly={!canWrite}
          lang={lang}
          d={d}
          onSaved={(saved) => setSelected(saved.key)}
        />
      )}
    </div>
  );
}
