"use client";

import { useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { HiPlus, HiTrash, HiX } from "react-icons/hi";
import { BrandLogo } from "@/features/common/components/brand-logo";
import CatalogTable from "@/features/common/components/catalog-table";
import { findCredentialType } from "@/features/credentials/credential.types";
import type { CatalogLayout } from "@/features/common/components/layout-toggle";
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
  metaTemplateLock,
} from "./meta-template-model";
import MetaTemplatePreview from "./meta-template-preview";
import MetaStatusChip, { metaStatusLabel } from "./meta-template-status";

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
  const locked = metaTemplateLock(template);
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

export type MetaFilters = {
  status: string;
  category: string;
  template: string;
};

export const NO_META_FILTERS: MetaFilters = {
  status: "",
  category: "",
  template: "",
};

/** How the template filter names a template: two languages can share a name. */
export function metaTemplateLabel(t: MetaTemplate) {
  return `${t.name} · ${t.language}`;
}

function metaPasses(t: MetaTemplate, f: MetaFilters, d: I18nRecord) {
  if (f.status && metaStatusLabel(t.status, d) !== f.status) return false;
  return !f.category || categoryLabel(t.category, d) === f.category;
}

/** The header filters: state and category narrow the list, and the template filter opens one. */
export function metaFilterDefs(
  templates: MetaTemplate[],
  f: MetaFilters,
  d: I18nRecord
): { key: keyof MetaFilters; label: string; options: string[] }[] {
  return [
    {
      key: "status",
      label: tr("filterState", d),
      options: [...new Set(templates.map((t) => metaStatusLabel(t.status, d)))],
    },
    {
      key: "category",
      label: tr("metaCategory", d),
      options: [...new Set(templates.map((t) => categoryLabel(t.category, d)))],
    },
    {
      key: "template",
      label: tr("colTemplate", d),
      options: templates
        .filter((t) => metaPasses(t, f, d))
        .map(metaTemplateLabel),
    },
  ];
}

/** The header action that starts a new template. */
export function NewMetaTemplateButton({
  d,
  onNew,
}: Readonly<{ d: I18nRecord; onNew: () => void }>) {
  return (
    <Button size="sm" color="blue" onClick={onNew}>
      <HiPlus className="mr-1 h-4 w-4" />
      {tr("metaNewTemplate", d)}
    </Button>
  );
}

const CARD =
  "flex flex-col rounded-lg border border-gray-200 bg-white text-left transition hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500";

const WHATSAPP = findCredentialType("WHATSAPP");

/** WhatsApp's mark as Credenciales and Conexiones draw it: 40 px on a card, 24 px in a row. */
function WhatsAppMark({ size }: Readonly<{ size: number }>) {
  return (
    <BrandLogo
      logo={WHATSAPP?.logo}
      icon={WHATSAPP?.icon}
      keyline={WHATSAPP?.keyline}
      alt="WhatsApp"
      size={size}
    />
  );
}

/** A template laid out like the message template cards: name, language, body, and the status at the foot. */
function MetaTemplateCard({
  template,
  d,
  onOpen,
}: Readonly<{
  template: MetaTemplate;
  d: I18nRecord;
  onOpen: (t: MetaTemplate) => void;
}>) {
  return (
    <button type="button" className={CARD} onClick={() => onOpen(template)}>
      <div className="flex w-full items-start gap-3 px-4 pt-4">
        <WhatsAppMark size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono font-semibold text-gray-900 dark:text-white">
            {template.name}
          </div>
          <div className={`truncate text-xs ${MUTED}`}>
            {categoryLabel(template.category, d)}
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 h-8 px-4 text-xs text-gray-600 dark:text-gray-300">
        {template.body || "—"}
      </p>
      {template.status === "REJECTED" && template.rejectedReason && (
        <p className="mt-2 px-4 text-xs text-red-600 dark:text-red-400">
          {template.rejectedReason}
        </p>
      )}
      {/* Keeps the footers of a row of cards on one line. */}
      <div className="min-h-3 flex-1" />
      <div className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs dark:border-gray-700/60">
        <span className={`font-mono ${MUTED}`}>{template.language}</span>
        <span className="ml-auto">
          <MetaStatusChip status={template.status} d={d} />
        </span>
      </div>
    </button>
  );
}

function MetaTemplatesTable({
  templates,
  d,
  onOpen,
}: Readonly<{
  templates: MetaTemplate[];
  d: I18nRecord;
  onOpen: (t: MetaTemplate) => void;
}>) {
  return (
    <CatalogTable
      columns={[
        tr("colTemplate", d),
        tr("metaLanguage", d),
        tr("metaCategory", d),
        tr("filterState", d),
      ]}
    >
      {templates.map((t) => (
        <tr
          key={t.id}
          className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
        >
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <WhatsAppMark size={24} />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpen(t)}
                  className="text-left font-mono text-sm font-medium text-gray-900 hover:underline dark:text-white"
                >
                  {t.name}
                </button>
                <div className="line-clamp-1 max-w-xl text-xs text-gray-600 dark:text-gray-300">
                  {t.body || "—"}
                </div>
                {t.status === "REJECTED" && t.rejectedReason && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {t.rejectedReason}
                  </div>
                )}
              </div>
            </div>
          </td>
          <td className={`whitespace-nowrap px-4 py-2.5 font-mono ${MUTED}`}>
            {t.language}
          </td>
          <td className="whitespace-nowrap px-4 py-2.5">
            {categoryLabel(t.category, d)}
          </td>
          <td className="px-4 py-2.5">
            <MetaStatusChip status={t.status} d={d} />
          </td>
        </tr>
      ))}
    </CatalogTable>
  );
}

/**
 * "WhatsApp en Meta": the WABA's templates as cards or a table, narrowed by the header filters. Picking one in
 * the template filter, or in the catalog, opens its editor.
 */
export default function MetaTemplatesSection({
  canWrite,
  d,
  filters,
  layout,
  creating,
  onOpen,
}: Readonly<{
  canWrite: boolean;
  d: I18nRecord;
  filters: MetaFilters;
  layout: CatalogLayout;
  /** True while a new template is being written. */
  creating: boolean;
  /** Opens a template's editor; null goes back to the catalog. */
  onOpen: (template: MetaTemplate | null) => void;
}>) {
  const { data: templates, error, isLoading } = useMetaTemplates();
  const shown =
    templates?.find((t) => metaTemplateLabel(t) === filters.template) ?? null;

  if (creating || shown) {
    return (
      <MetaTemplateEditor
        key={creating ? "new" : shown?.id}
        template={creating ? null : shown}
        canWrite={canWrite}
        d={d}
        onSaved={onOpen}
        onDeleted={() => onOpen(null)}
      />
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {loadError(error, d)}
      </p>
    );
  }
  if (isLoading)
    return <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>;
  if (templates?.length === 0) {
    return (
      <p className={`py-10 text-center text-sm ${MUTED}`}>
        {tr("metaNoTemplates", d)}
      </p>
    );
  }
  const visible = (templates ?? []).filter((t) => metaPasses(t, filters, d));
  if (visible.length === 0) {
    return (
      <p className={`py-10 text-center text-sm ${MUTED}`}>
        {tr("templatesEmptyFiltered", d)}
      </p>
    );
  }
  if (layout === "list") {
    return <MetaTemplatesTable templates={visible} d={d} onOpen={onOpen} />;
  }
  return (
    <section
      aria-label={tr("metaTemplatesList", d)}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
    >
      {visible.map((t) => (
        <MetaTemplateCard key={t.id} template={t} d={d} onOpen={onOpen} />
      ))}
    </section>
  );
}
