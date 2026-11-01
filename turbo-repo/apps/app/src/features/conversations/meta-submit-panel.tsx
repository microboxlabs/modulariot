"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import { HiOutlinePaperAirplane } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { FIELD } from "@/features/symptoms/maintainer/ui/response-block";
import Select from "@/features/symptoms/maintainer/ui/select";
import {
  createMetaTemplate,
  editMetaTemplate,
  previewTemplateEmail,
  refreshMetaTemplates,
  refreshTemplates,
  saveTemplate,
} from "./conversations-api";
import type {
  ConversationTemplate,
  MetaTemplate,
  MetaTemplateCategory,
  MetaTemplateDraft,
  TemplateBody,
  WhatsAppVariant,
} from "./conversations-types";
import { findMetaTemplate } from "./meta-template-combobox";
import {
  EMPTY_META_DRAFT,
  META_CATEGORIES,
  draftParams,
  draftProblems,
  metaTemplateLock,
} from "./meta-template-model";

const CATEGORY_LABEL: Record<(typeof META_CATEGORIES)[number], string> = {
  UTILITY: "metaCategoryUtility",
  MARKETING: "metaCategoryMarketing",
};

/** What the WhatsApp variant has to do on Meta: submit it, send changes, or nothing. */
export type MetaSync = "create" | "update" | null;

/**
 * Whether the variant's Meta template is missing, rejected or differs from the message text. A template under
 * review is left alone: Meta does not take edits until it decides.
 */
export function metaSync(
  variant: WhatsAppVariant,
  baseText: string,
  templates: MetaTemplate[]
): { sync: MetaSync; meta: MetaTemplate | null } {
  const meta = findMetaTemplate(templates, variant.metaName, variant.language);
  if (meta?.language !== variant.language)
    return { sync: "create", meta: null };
  if (metaTemplateLock(meta)) return { sync: null, meta };
  if (meta.status === "REJECTED") return { sync: "update", meta };
  return { sync: meta.body === baseText.trim() ? null : "update", meta };
}

/** The draft Meta receives: the message text as the body, under the variant's name and language. */
export function draftFromTemplate(
  variant: WhatsAppVariant,
  baseText: string,
  category: MetaTemplateCategory,
  examples: Record<string, string>,
  meta: MetaTemplate | null
): MetaTemplateDraft {
  const draft: MetaTemplateDraft = {
    ...EMPTY_META_DRAFT,
    // An edit keeps what Meta has besides the body: header, footer and buttons.
    ...(meta && {
      header: meta.headerFormat === "TEXT" ? (meta.header ?? "") : "",
      footer: meta.footer ?? "",
      buttons: meta.buttons,
    }),
    name: variant.metaName,
    language: variant.language,
    category,
    body: baseText.trim(),
  };
  const params = draftParams(draft);
  return {
    ...draft,
    examples: Object.fromEntries(
      params.map((p) => [p, (examples[p] ?? meta?.examples[p] ?? "").trim()])
    ),
  };
}

/**
 * Sends a message template's text to Meta for review, so the WhatsApp version is written once. The examples are
 * the editor's, the ones its preview shows. On success the template is saved with the variables Meta will fill.
 */
export default function MetaSubmitPanel({
  templateKey,
  body,
  variant,
  templates,
  examples,
  dirty,
  busy,
  blocked,
  d,
  onExamples,
  onBusyChange,
  onSaved,
}: Readonly<{
  templateKey: string;
  body: TemplateBody;
  variant: WhatsAppVariant;
  templates: MetaTemplate[];
  examples: Record<string, string>;
  /** Unsaved changes: they are saved with the submission. */
  dirty: boolean;
  busy: boolean;
  blocked: boolean;
  d: I18nRecord;
  onExamples: (examples: Record<string, string>) => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: (saved: ConversationTemplate) => void;
}>) {
  const { sync, meta } = metaSync(variant, body.baseText, templates);
  const categoryKey = JSON.stringify([
    variant.metaName,
    variant.language,
    meta?.category,
  ]);
  const [categoryChoice, setCategoryChoice] = useState<{
    template: string;
    value: MetaTemplateCategory;
  } | null>(null);
  const defaultCategory =
    meta?.category === "MARKETING" ? "MARKETING" : "UTILITY";
  const category =
    categoryChoice?.template === categoryKey
      ? categoryChoice.value
      : defaultCategory;
  const [error, setError] = useState<string | null>(null);
  const locked = metaTemplateLock(meta);
  if (locked && locked !== "metaLockedPending")
    return <p className={`text-xs ${MUTED}`}>{trDynamic(locked, d)}</p>;
  if (!sync)
    return error ? (
      <p role="alert" className="text-xs text-red-600 dark:text-red-400">
        {error}
      </p>
    ) : null;

  const draft = draftFromTemplate(
    variant,
    body.baseText,
    category,
    examples,
    meta
  );
  const params = draftParams(draft);
  const problems = draftProblems(draft, sync === "create");

  const submit = async () => {
    if (busy || blocked || problems.length > 0) return;
    onBusyChange(true);
    setError(null);
    try {
      if (body.email?.html?.trim())
        await previewTemplateEmail(
          body.email.subject,
          body.email.html,
          examples
        );
      const submitted = meta
        ? await editMetaTemplate(meta.id, draft)
        : await createMetaTemplate(draft);
      await refreshMetaTemplates(submitted);
      const saved = await saveTemplate(templateKey, {
        ...body,
        name: body.name.trim(),
        whatsapp: { ...variant, params },
      });
      await refreshTemplates(templateKey);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <section
      aria-label={tr("metaSubmitReview", d)}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {sync === "create"
              ? tr("metaSubmitTitle", d)
              : tr("metaUpdateTitle", d)}
          </h3>
          <p className={`text-xs ${MUTED}`}>
            {sync === "create"
              ? tr("metaSubmitIntro", d, { name: variant.metaName })
              : tr("metaUpdateIntro", d)}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          {tr("metaCategory", d)}
          <Select
            aria-label={tr("metaCategory", d)}
            className={FIELD}
            disabled={busy}
            value={category}
            onChange={(e) =>
              setCategoryChoice({
                template: categoryKey,
                value: e.target.value as MetaTemplateCategory,
              })
            }
          >
            {META_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {trDynamic(CATEGORY_LABEL[c], d)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {params.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={`text-xs ${MUTED}`}>{tr("metaSubmitHint", d)}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {params.map((p) => (
              <label key={p} className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{`{{${p}}}`}</span>
                <input
                  aria-label={tr("metaExampleFor", d, { name: p })}
                  className={FIELD}
                  disabled={busy}
                  value={draft.examples[p]}
                  onChange={(e) =>
                    onExamples({ ...examples, [p]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      )}
      {problems.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-red-600 dark:text-red-400">
          {problems.map((p) => (
            <li key={`${p.key}-${JSON.stringify(p.values ?? {})}`}>
              {trDynamic(p.key, d, p.values)}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {dirty && (
          <span className={`text-xs ${MUTED}`}>{tr("metaSubmitSaves", d)}</span>
        )}
        <Button
          size="sm"
          disabled={busy || blocked || problems.length > 0}
          onClick={() => void submit()}
        >
          <HiOutlinePaperAirplane
            aria-hidden
            className="mr-1.5 h-4 w-4 rotate-90"
          />
          {busy ? tr("metaSubmitting", d) : tr("metaSubmitReview", d)}
        </Button>
      </div>
    </section>
  );
}
