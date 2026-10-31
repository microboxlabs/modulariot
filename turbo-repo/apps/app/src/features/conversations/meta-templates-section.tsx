"use client";

import { useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { HiPlus, HiRefresh, HiTrash, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import {
  FIELD,
  FieldRow,
  ResponseBlock,
} from "@/features/symptoms/maintainer/ui/response-block";
import Select from "@/features/symptoms/maintainer/ui/select";
import { ICON_BUTTON } from "./audience-list";
import {
  createMetaTemplate,
  deleteMetaTemplate,
  editMetaTemplate,
  refreshMetaTemplates,
  useMetaTemplates,
} from "./conversations-api";
import type {
  MetaButtonType,
  MetaTemplate,
  MetaTemplateButton,
  MetaTemplateCategory,
  MetaTemplateDraft,
} from "./conversations-types";
import {
  BUTTON_TYPES,
  LIMITS,
  META_CATEGORIES,
  META_LANGUAGES,
  draftOf,
  draftParams,
  draftProblems,
} from "./meta-template-model";
import MetaTemplatePreview from "./meta-template-preview";
import MetaStatusChip from "./meta-template-status";

const BUTTON_LABEL: Record<MetaButtonType, string> = {
  QUICK_REPLY: "metaButtonQuickReply",
  URL: "metaButtonUrl",
  PHONE_NUMBER: "metaButtonPhone",
};

const CATEGORY_LABEL: Record<string, string> = {
  UTILITY: "metaCategoryUtility",
  MARKETING: "metaCategoryMarketing",
  AUTHENTICATION: "metaCategoryAuthentication",
};

function categoryLabel(category: string, d: I18nRecord) {
  const key = CATEGORY_LABEL[category];
  return key ? trDynamic(key, d) : category;
}

/** No WhatsApp connection gets its own sentence; any other failure shows the server's. */
function loadError(error: unknown, d: I18nRecord) {
  if (error instanceof ControlTowerError && error.status === 409)
    return tr("metaNoConnection", d);
  return error instanceof Error && error.message
    ? error.message
    : tr("loadFailed", d);
}

/** Why the app does not edit this template, or null when it does. */
function lockedReason(t: MetaTemplate | null): string | null {
  if (!t) return null;
  if (t.status === "PENDING") return "metaLockedPending";
  if (t.category === "AUTHENTICATION") return "metaLockedAuthentication";
  if (t.headerFormat && t.headerFormat !== "TEXT") return "metaLockedMedia";
  if (t.parameterFormat !== "NAMED" && t.params.length > 0)
    return "metaLockedPositional";
  return null;
}

function ButtonsEditor({
  buttons,
  readOnly,
  d,
  onChange,
}: Readonly<{
  buttons: MetaTemplateButton[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (buttons: MetaTemplateButton[]) => void;
}>) {
  const set = (i: number, patch: Partial<MetaTemplateButton>) =>
    onChange(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="flex flex-col gap-2">
      {buttons.length === 0 && (
        <p className={`text-sm ${MUTED}`}>{tr("metaNoButtons", d)}</p>
      )}
      {buttons.map((b, i) => (
        <div
          key={`${i}-${b.type}`}
          className="flex flex-wrap items-center gap-2"
        >
          <Select
            aria-label={tr("metaButtonType", d, { n: String(i + 1) })}
            className={FIELD}
            disabled={readOnly}
            value={b.type}
            onChange={(e) =>
              set(i, {
                type: e.target.value as MetaButtonType,
                url: null,
                phoneNumber: null,
              })
            }
          >
            {BUTTON_TYPES.map((type) => (
              <option key={type} value={type}>
                {trDynamic(BUTTON_LABEL[type], d)}
              </option>
            ))}
          </Select>
          <input
            aria-label={tr("metaButtonText", d, { n: String(i + 1) })}
            className={`${FIELD} w-44`}
            disabled={readOnly}
            maxLength={LIMITS.buttonText}
            placeholder={tr("metaButtonTextPlaceholder", d)}
            value={b.text}
            onChange={(e) => set(i, { text: e.target.value })}
          />
          {b.type === "URL" && (
            <input
              aria-label={tr("metaButtonUrlField", d, { n: String(i + 1) })}
              className={`${FIELD} min-w-48 flex-1 font-mono`}
              disabled={readOnly}
              placeholder="https://"
              value={b.url ?? ""}
              onChange={(e) => set(i, { url: e.target.value })}
            />
          )}
          {b.type === "PHONE_NUMBER" && (
            <input
              aria-label={tr("metaButtonPhoneField", d, { n: String(i + 1) })}
              className={`${FIELD} w-44 font-mono`}
              disabled={readOnly}
              placeholder="+15550000000"
              value={b.phoneNumber ?? ""}
              onChange={(e) => set(i, { phoneNumber: e.target.value })}
            />
          )}
          {!readOnly && (
            <button
              type="button"
              aria-label={tr("metaRemoveButton", d, { n: String(i + 1) })}
              className={ICON_BUTTON}
              onClick={() => onChange(buttons.filter((_, j) => j !== i))}
            >
              <HiX className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && buttons.length < LIMITS.buttons && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange([...buttons, { type: "QUICK_REPLY", text: "" }])
          }
        >
          <HiPlus aria-hidden className="h-4 w-4" />
          {tr("metaAddButton", d)}
        </button>
      )}
    </div>
  );
}

function DeleteDialog({
  template,
  d,
  onClose,
  onDeleted,
}: Readonly<{
  template: MetaTemplate;
  d: I18nRecord;
  onClose: () => void;
  onDeleted: () => void;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteMetaTemplate(template.name, template.id);
      await refreshMetaTemplates();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <Modal show size="md" onClose={busy ? () => undefined : onClose}>
      <ModalHeader>{tr("metaDeleteTitle", d)}</ModalHeader>
      <ModalBody>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {tr("metaDeleteText", d, {
            name: template.name,
            language: template.language,
          })}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-3 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" disabled={busy} onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button color="red" disabled={busy} onClick={() => void remove()}>
          {tr("metaDelete", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/** One template on Meta: its fields, the examples, the buttons and how it looks in WhatsApp. */
export function MetaTemplateEditor({
  template,
  canWrite,
  d,
  onSaved,
  onDeleted,
}: Readonly<{
  /** Null for a new template. */
  template: MetaTemplate | null;
  canWrite: boolean;
  d: I18nRecord;
  onSaved: (saved: MetaTemplate) => void;
  onDeleted: () => void;
}>) {
  const [draft, setDraft] = useState<MetaTemplateDraft>(() =>
    draftOf(template)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isNew = template === null;
  const locked = lockedReason(template);
  const readOnly = !canWrite || locked !== null;
  const set = (patch: Partial<MetaTemplateDraft>) =>
    setDraft({ ...draft, ...patch });
  const params = draftParams(draft);
  const problems = draftProblems(draft, isNew);
  const languages = META_LANGUAGES.includes(draft.language)
    ? META_LANGUAGES
    : [draft.language, ...META_LANGUAGES];

  const submitLabel = isNew ? tr("metaSubmit", d) : tr("metaSubmitEdit", d);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const examples = Object.fromEntries(
      params.map((p) => [p, (draft.examples[p] ?? "").trim()])
    );
    const body = { ...draft, examples };
    try {
      const saved = template
        ? await editMetaTemplate(template.id, body)
        : await createMetaTemplate(body);
      await refreshMetaTemplates();
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ResponseBlock
        title={isNew ? tr("metaNewTemplate", d) : draft.name}
        aside={
          template && (
            <div className="flex items-center gap-2">
              <MetaStatusChip status={template.status} d={d} />
              {canWrite && (
                <button
                  type="button"
                  aria-label={tr("metaDelete", d)}
                  className={ICON_BUTTON}
                  onClick={() => setDeleting(true)}
                >
                  <HiTrash className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        }
      >
        {template?.status === "REJECTED" && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("metaRejectedReason", d, {
              reason: template.rejectedReason ?? "—",
            })}
          </p>
        )}
        {locked && <p className={`text-sm ${MUTED}`}>{trDynamic(locked, d)}</p>}
        <FieldRow label={tr("metaTemplateName", d)}>
          <input
            aria-label={tr("metaTemplateName", d)}
            className={`${FIELD} min-w-48 flex-1 font-mono`}
            disabled={readOnly || !isNew}
            maxLength={512}
            placeholder="trip_alert_v1"
            value={draft.name}
            onChange={(e) =>
              set({
                name: e.target.value.toLowerCase().replaceAll(/[\s-]/g, "_"),
              })
            }
          />
        </FieldRow>
        <FieldRow label={tr("metaLanguage", d)}>
          <Select
            aria-label={tr("metaLanguage", d)}
            className={`${FIELD} font-mono`}
            disabled={readOnly || !isNew}
            value={draft.language}
            onChange={(e) => set({ language: e.target.value })}
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label={tr("metaCategory", d)}>
          <Select
            aria-label={tr("metaCategory", d)}
            className={FIELD}
            disabled={readOnly}
            value={draft.category}
            onChange={(e) =>
              set({ category: e.target.value as MetaTemplateCategory })
            }
          >
            {META_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c, d)}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ResponseBlock>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <ResponseBlock title={tr("metaContent", d)}>
            <FieldRow label={tr("metaHeader", d)}>
              <input
                aria-label={tr("metaHeader", d)}
                className={`${FIELD} min-w-48 flex-1`}
                disabled={readOnly}
                maxLength={LIMITS.header}
                placeholder={tr("optional", d)}
                value={draft.header}
                onChange={(e) => set({ header: e.target.value })}
              />
            </FieldRow>
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
              {tr("metaBody", d)}
              <textarea
                aria-label={tr("metaBody", d)}
                rows={5}
                className={FIELD}
                disabled={readOnly}
                maxLength={LIMITS.body}
                placeholder={tr("metaBodyPlaceholder", d)}
                value={draft.body}
                onChange={(e) => set({ body: e.target.value })}
              />
              <span className={`text-xs ${MUTED}`}>
                {tr("metaBodyHint", d)}
              </span>
            </label>
            <FieldRow label={tr("metaFooter", d)}>
              <input
                aria-label={tr("metaFooter", d)}
                className={`${FIELD} min-w-48 flex-1`}
                disabled={readOnly}
                maxLength={LIMITS.footer}
                placeholder={tr("optional", d)}
                value={draft.footer}
                onChange={(e) => set({ footer: e.target.value })}
              />
            </FieldRow>
          </ResponseBlock>

          <ResponseBlock title={tr("metaExamples", d)}>
            {params.length === 0 ? (
              <p className={`text-sm ${MUTED}`}>{tr("metaNoParams", d)}</p>
            ) : (
              params.map((p) => (
                <FieldRow key={p} label={`{{${p}}}`}>
                  <input
                    aria-label={tr("metaExampleFor", d, { name: p })}
                    className={`${FIELD} min-w-48 flex-1`}
                    disabled={readOnly}
                    value={draft.examples[p] ?? ""}
                    onChange={(e) =>
                      set({
                        examples: { ...draft.examples, [p]: e.target.value },
                      })
                    }
                  />
                </FieldRow>
              ))
            )}
          </ResponseBlock>

          <ResponseBlock title={tr("metaButtons", d)}>
            <ButtonsEditor
              buttons={draft.buttons}
              readOnly={readOnly}
              d={d}
              onChange={(buttons) => set({ buttons })}
            />
          </ResponseBlock>
        </div>
        <ResponseBlock title={tr("preview", d)}>
          <MetaTemplatePreview
            draft={draft}
            label={tr("metaPreviewLabel", d)}
          />
        </ResponseBlock>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {problems.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-sm text-red-600 dark:text-red-400">
              {problems.map((p) => (
                <li key={`${p.key}-${JSON.stringify(p.values ?? {})}`}>
                  {trDynamic(p.key, d, p.values)}
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button
            disabled={saving || problems.length > 0}
            onClick={() => void submit()}
          >
            {saving ? tr("metaSubmitting", d) : submitLabel}
          </Button>
        </div>
      )}
      {deleting && template && (
        <DeleteDialog
          template={template}
          d={d}
          onClose={() => setDeleting(false)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}

/** "WhatsApp en Meta": the WABA's templates beside the selected one's editor. */
export default function MetaTemplatesSection({
  canWrite,
  d,
}: Readonly<{ canWrite: boolean; d: I18nRecord }>) {
  const {
    data: templates,
    error,
    isLoading,
    isValidating,
  } = useMetaTemplates();
  // A template id, "new", or null for the first one.
  const [selected, setSelected] = useState<string | null>(null);
  const current = selected ?? templates?.[0]?.id ?? null;
  const shown =
    selected === "new"
      ? null
      : (templates?.find((t) => t.id === current) ?? null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav
        aria-label={tr("metaTemplatesList", d)}
        className="flex flex-col gap-1 self-start rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center gap-1">
          {canWrite && (
            <button
              type="button"
              className="flex flex-1 items-center gap-1.5 rounded-md px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-700"
              onClick={() => setSelected("new")}
            >
              <HiPlus aria-hidden className="h-4 w-4" />
              {tr("metaNewTemplate", d)}
            </button>
          )}
          <button
            type="button"
            aria-label={tr("metaRefresh", d)}
            title={tr("metaRefresh", d)}
            className={`${ICON_BUTTON} ml-auto`}
            disabled={isValidating}
            onClick={() => void refreshMetaTemplates()}
          >
            <HiRefresh
              className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {loadError(error, d)}
          </p>
        )}
        {isLoading && (
          <p className={`px-3 py-2 text-sm ${MUTED}`}>{tr("loading", d)}</p>
        )}
        {templates?.length === 0 && (
          <p className={`px-3 py-2 text-sm ${MUTED}`}>
            {tr("metaNoTemplates", d)}
          </p>
        )}
        {(templates ?? []).map((t) => {
          const active = t.id === current && selected !== "new";
          return (
            <button
              key={t.id}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setSelected(t.id)}
              className={`flex flex-col gap-1 rounded-md px-3 py-2 text-left text-sm ${
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-gray-700 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono font-medium">
                  {t.name}
                </span>
                <MetaStatusChip status={t.status} d={d} />
              </span>
              <span className={`text-xs ${MUTED}`}>
                {t.language} · {categoryLabel(t.category, d)}
              </span>
              {t.status === "REJECTED" && t.rejectedReason && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {t.rejectedReason}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {(shown || selected === "new") && (
        <MetaTemplateEditor
          key={selected === "new" ? "new" : shown?.id}
          template={shown}
          canWrite={canWrite}
          d={d}
          onSaved={(saved) => setSelected(saved.id)}
          onDeleted={() => setSelected(null)}
        />
      )}
    </div>
  );
}
