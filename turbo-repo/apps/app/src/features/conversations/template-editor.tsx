"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, ToggleSwitch } from "flowbite-react";
import {
  HiChevronLeft,
  HiOutlineDuplicate,
  HiOutlineReply,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ago } from "@/features/symptoms/maintainer/catalog-format";
import { keyFrom } from "@/features/symptoms/maintainer/create-symptom-modal";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { CHANGED_DOT } from "@/features/symptoms/maintainer/ui/changed";
import { FIELD } from "@/features/symptoms/maintainer/ui/response-block";
import NumberedSection from "@/features/symptoms/maintainer/ui/section";
import Select from "@/features/symptoms/maintainer/ui/select";
import SheetTop from "@/features/symptoms/maintainer/ui/sheet-top";
import { channelLogo } from "./channel-icon";
import {
  refreshTemplates,
  saveTemplate,
  useEventCatalog,
  useMetaTemplates,
} from "./conversations-api";
import type {
  ConversationTemplate,
  EmailVariant,
  MetaTemplate,
  TemplateBody,
  WhatsAppVariant,
} from "./conversations-types";
import MetaTemplateCombobox, {
  findMetaTemplate,
} from "./meta-template-combobox";
import MetaSubmitPanel from "./meta-submit-panel";
import { textVariables } from "./rule-model";
import {
  EventSelect,
  MetaStatusLine,
  TemplateReviewPanel,
  TemplateVariablesPanel,
  UsedByPanel,
} from "./template-editor-parts";
import {
  changedFields,
  exampleValues,
  metaNameFrom,
  sendParams,
  templateFindings,
  templateVariables,
  textToHtml,
  usedEvents,
  withHtml,
} from "./template-model";
import { TemplatePreviewPanel } from "./template-previews";
import TemplateTextField, { type Inserter } from "./template-text-field";
import { plainText } from "./whatsapp-text";

export { SAMPLE_VALUES } from "./template-model";

const EMPTY: TemplateBody = {
  name: "",
  baseText: "",
  whatsapp: null,
  email: null,
};

/** Languages Meta takes for a template; the variant's own is added when it is not one of them. */
const META_LANGUAGES = [
  "es",
  "es_AR",
  "es_CL",
  "es_ES",
  "es_MX",
  "en",
  "en_US",
  "pt_BR",
];

const LABEL = "text-sm font-medium text-gray-900 dark:text-white";

function bodyOf(t: ConversationTemplate | null): TemplateBody {
  if (!t) return EMPTY;
  return {
    name: t.name,
    baseText: t.baseText ?? "",
    whatsapp: t.whatsapp,
    email: withHtml(t.email),
  };
}

/** The channels the template reaches: the text ones always, WhatsApp and email when it has them. */
function reachedChannels(body: TemplateBody): string[] {
  return [
    ...(body.whatsapp ? ["whatsapp"] : []),
    ...(body.email ? ["email"] : []),
    "slack",
    "teams",
    "webhook",
  ];
}

/** The Meta template of the variant, only when it is in the variant's language. */
function metaOf(
  body: TemplateBody,
  templates: MetaTemplate[] | undefined
): MetaTemplate | null {
  if (!body.whatsapp) return null;
  const meta = findMetaTemplate(
    templates,
    body.whatsapp.metaName,
    body.whatsapp.language
  );
  return meta?.language === body.whatsapp.language ? meta : null;
}

function changesLabel(n: number, d: I18nRecord) {
  return n === 1
    ? tr("tplOneChange", d)
    : tr("tplChanges", d, { n: String(n) });
}

function SheetHeader({
  template,
  body,
  templateKey,
  backHref,
  lang,
  d,
  actions,
}: Readonly<{
  template: ConversationTemplate | null;
  body: TemplateBody;
  templateKey: string;
  backHref: string;
  lang: string;
  d: I18nRecord;
  actions: React.ReactNode;
}>) {
  return (
    <div className="flex flex-wrap items-start gap-3 lg:flex-nowrap">
      <Link
        href={backHref}
        aria-label={tr("backToTemplates", d)}
        title={tr("backToTemplates", d)}
        className={`mt-1.5 rounded p-1 ${MUTED} hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white`}
      >
        <HiChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold break-words text-gray-900 dark:text-white">
            {body.name.trim() || tr("newTemplate", d)}
          </h1>
          <span className="rounded-md border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 dark:border-gray-600 dark:text-gray-200">
            {template?.version ? `v${template.version}` : tr("tplUnsaved", d)}
          </span>
        </div>
        <div
          className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${MUTED}`}
        >
          <span className="font-mono">{templateKey || "—"}</span>
          {template?.updatedAt && (
            <span>· {ago(template.updatedAt, lang)}</span>
          )}
          {template && (
            <span>
              ·{" "}
              {tr("tplUsedByCount", d, {
                n: String(template.usedBy?.length ?? 0),
              })}
            </span>
          )}
          <span
            className="flex items-center gap-1.5"
            title={tr("tplReaches", d)}
          >
            ·
            {reachedChannels(body).map((c) => {
              const Icon = channelLogo(c);
              return <Icon key={c} aria-hidden className="h-3.5 w-3.5" />;
            })}
          </span>
        </div>
      </div>
      {actions}
    </div>
  );
}

function SaveActions({
  changes,
  blocking,
  saving,
  canSave,
  canDiscard,
  error,
  d,
  onDiscard,
  onSave,
}: Readonly<{
  changes: number;
  blocking: number;
  saving: boolean;
  canSave: boolean;
  canDiscard: boolean;
  error: string | null;
  d: I18nRecord;
  onDiscard: () => void;
  onSave: () => void;
}>) {
  return (
    <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
      {error && (
        <span
          role="alert"
          className="max-w-64 break-words text-right text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </span>
      )}
      {changes > 0 && (
        <span className="flex h-[30px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
          <span
            className={`h-2 w-2 rounded-full ${saving ? "animate-pulse bg-blue-500" : CHANGED_DOT}`}
          />
          {changesLabel(changes, d)}
          {blocking > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {blocking}
            </span>
          )}
        </span>
      )}
      {canDiscard && (
        <button
          type="button"
          title={tr("discard", d)}
          aria-label={tr("discard", d)}
          disabled={saving}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={onDiscard}
        >
          <HiOutlineReply className="h-3.5 w-3.5" />
        </button>
      )}
      <Button size="sm" disabled={!canSave} onClick={onSave}>
        {saving ? tr("saving", d) : tr("saveTemplate", d)}
      </Button>
    </div>
  );
}

/**
 * One message template, laid out like the rule and symptom editors: the template and its event, the message
 * text, the WhatsApp and email versions, and on the side the checks, a preview per channel, the variables and
 * the rules that use it.
 */
export function TemplateEditor({
  template,
  readOnly,
  lang,
  d,
  backHref,
  takenKeys = [],
  onSaved,
}: Readonly<{
  /** Null for a new template. */
  template: ConversationTemplate | null;
  readOnly: boolean;
  /** The keys of the stored templates; a new template cannot take one. */
  takenKeys?: string[];
  lang: string;
  d: I18nRecord;
  backHref: string;
  onSaved: (saved: ConversationTemplate) => void;
}>) {
  const stored = useMemo(() => bodyOf(template), [template]);
  const [body, setBody] = useState<TemplateBody>(stored);
  const used = useMemo(() => usedEvents(template), [template]);
  const [event, setEvent] = useState(used[0] ?? "");
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inserter = useRef<Inserter | null>(null);
  const { data: catalog } = useEventCatalog();
  // Without a WhatsApp connection the list fails and the name is typed by hand.
  const { data: metaTemplates } = useMetaTemplates(body.whatsapp !== null);

  const isNew = template === null;
  const key = template?.key ?? keyFrom(body.name);
  const taken = isNew && takenKeys.includes(key);
  const info = catalog?.find((e) => e.type === event);
  const variables = templateVariables(info, catalog);
  const known = info ? new Set(variables.map((v) => v.name)) : null;
  const usedNames = textVariables(
    [body.baseText, body.email?.subject ?? "", body.email?.html ?? ""].join(" ")
  );
  const examples = { ...exampleValues(variables, usedNames), ...edited };
  const meta = metaOf(body, metaTemplates);
  const findings = templateFindings({
    body,
    keyTaken: taken,
    variables: known ? [...known] : null,
    metaTemplates: body.whatsapp ? metaTemplates : undefined,
  });
  // Meta's state is outside the template: it does not stop a save.
  const blocking = findings.filter(
    (f) => f.severity === "error" && f.section !== "whatsapp"
  ).length;
  const changes = changedFields(body, isNew ? EMPTY : stored);
  const dirty = changes.length > 0;
  const editable = !readOnly && !saving;
  const canSubmit =
    Boolean(metaTemplates) &&
    !readOnly &&
    !isNew &&
    Boolean(body.whatsapp?.metaName.trim());

  // Functional: an inserter kept by the variables panel may outlive this render.
  const set = (patch: Partial<TemplateBody>) =>
    setBody((b) => ({ ...b, ...patch }));
  const setWhatsapp = (patch: Partial<WhatsAppVariant>) =>
    setBody((b) =>
      b.whatsapp ? { ...b, whatsapp: { ...b.whatsapp, ...patch } } : b
    );
  const setEmail = (patch: Partial<EmailVariant>) =>
    setBody((b) => (b.email ? { ...b, email: { ...b.email, ...patch } } : b));
  const focus = (i: Inserter) => {
    inserter.current = i;
  };
  const insert = (name: string) => {
    const text = `{{${name}}}`;
    if (inserter.current) inserter.current(text);
    else setBody((b) => ({ ...b, baseText: `${b.baseText}${text}` }));
  };
  const pickMeta = (t: MetaTemplate) => {
    setWhatsapp({ metaName: t.name, language: t.language, params: t.params });
    // An empty message takes the picked template's text.
    setBody((b) => (b.baseText.trim() ? b : { ...b, baseText: t.body ?? "" }));
  };
  const toggleWhatsapp = (on: boolean) =>
    set({
      whatsapp: on
        ? (stored.whatsapp ?? {
            metaName: metaNameFrom(key),
            language: "es",
            params: textVariables(body.baseText),
          })
        : null,
    });
  const toggleEmail = (on: boolean) =>
    set({
      email: on
        ? (stored.email ?? {
            subject: body.name,
            body: null,
            html: textToHtml(plainText(body.baseText)),
          })
        : null,
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveTemplate(key, {
        ...body,
        name: body.name.trim(),
        whatsapp: body.whatsapp && {
          ...body.whatsapp,
          params: sendParams(body, metaTemplates),
        },
      });
      await refreshTemplates(key);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const languages = [
    ...new Set([...META_LANGUAGES, body.whatsapp?.language ?? "es"]),
  ];

  return (
    <>
      <SheetTop>
        <SheetHeader
          template={template}
          body={body}
          templateKey={key}
          backHref={backHref}
          lang={lang}
          d={d}
          actions={
            !readOnly && (
              <SaveActions
                changes={changes.length}
                blocking={blocking}
                saving={saving}
                canSave={!saving && dirty && blocking === 0 && key.length >= 2}
                canDiscard={dirty && !isNew}
                error={error}
                d={d}
                onDiscard={() => setBody(stored)}
                onSave={() => void save()}
              />
            )
          }
        />
      </SheetTop>

      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-4 px-4 pt-3 pb-10 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <NumberedSection
            number={1}
            title={tr("tplSectionGeneral", d)}
            subtitle={tr("tplSectionGeneralHint", d)}
            changed={changes.includes("name")}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>{tr("templateName", d)}</span>
                <input
                  aria-label={tr("templateName", d)}
                  className={FIELD}
                  disabled={!editable}
                  maxLength={200}
                  value={body.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
                <span className={`text-xs ${MUTED}`}>
                  {tr("templateKey", d)}{" "}
                  <span className="font-mono">{key || "—"}</span>
                </span>
                {taken && (
                  <span
                    role="alert"
                    className="text-xs text-red-600 dark:text-red-400"
                  >
                    {tr("templateKeyTaken", d)}
                  </span>
                )}
              </label>
              <div className="flex flex-col gap-1">
                <span className={LABEL}>{tr("tplEvent", d)}</span>
                <EventSelect
                  value={event}
                  catalog={catalog}
                  used={used}
                  d={d}
                  onChange={setEvent}
                />
                <span className={`text-xs ${MUTED}`}>
                  {tr("tplEventHint", d)}
                </span>
              </div>
            </div>
          </NumberedSection>

          <NumberedSection
            number={2}
            title={tr("channelWhatsapp", d)}
            subtitle={tr("tplSectionWhatsappHint", d)}
            changed={
              changes.includes("whatsapp") ||
              (body.whatsapp !== null && changes.includes("baseText"))
            }
            actions={
              <ToggleSwitch
                checked={body.whatsapp !== null}
                disabled={!editable}
                label={tr("tplChannelOn", d)}
                onChange={toggleWhatsapp}
              />
            }
          >
            {body.whatsapp ? (
              <>
                <TemplateTextField
                  label={tr("tplText", d)}
                  value={body.baseText}
                  onChange={(baseText) => set({ baseText })}
                  variables={variables}
                  known={known}
                  d={d}
                  readOnly={!editable}
                  rows={6}
                  formatting
                  placeholder={tr("baseTextPlaceholder", d)}
                  hint={tr("tplTextHint", d)}
                  onFocusField={focus}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_10rem]">
                  <div className="flex flex-col gap-1">
                    <span className={LABEL}>{tr("metaName", d)}</span>
                    {metaTemplates ? (
                      <MetaTemplateCombobox
                        name={body.whatsapp.metaName}
                        language={body.whatsapp.language}
                        templates={metaTemplates}
                        readOnly={!editable}
                        d={d}
                        onPick={pickMeta}
                        onName={(metaName) => setWhatsapp({ metaName })}
                      />
                    ) : (
                      <input
                        aria-label={tr("metaName", d)}
                        className={`${FIELD} font-mono`}
                        disabled={!editable}
                        value={body.whatsapp.metaName}
                        onChange={(e) =>
                          setWhatsapp({ metaName: e.target.value })
                        }
                      />
                    )}
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className={LABEL}>{tr("metaLanguage", d)}</span>
                    <Select
                      aria-label={tr("metaLanguage", d)}
                      className={`${FIELD} font-mono`}
                      wrapperClassName="w-full"
                      disabled={!editable}
                      value={body.whatsapp.language}
                      onChange={(e) =>
                        setWhatsapp({ language: e.target.value })
                      }
                    >
                      {languages.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                {body.whatsapp.metaName.trim() && (
                  <MetaStatusLine
                    variant={body.whatsapp}
                    meta={meta}
                    templates={metaTemplates}
                    d={d}
                  />
                )}
                <p className={`text-xs ${MUTED}`}>
                  {tr("tplSendsParams", d)}{" "}
                  <span className="font-mono">
                    {sendParams(body, metaTemplates)
                      .map((p) => `{{${p}}}`)
                      .join(" ") || "—"}
                  </span>
                </p>
                {isNew && !readOnly && (
                  <p className={`text-xs ${MUTED}`}>
                    {tr("tplSaveToSubmit", d)}
                  </p>
                )}
                {canSubmit && metaTemplates && (
                  <MetaSubmitPanel
                    templateKey={key}
                    body={body}
                    variant={body.whatsapp}
                    templates={metaTemplates}
                    examples={examples}
                    dirty={dirty}
                    d={d}
                    onExamples={setEdited}
                    onSaved={onSaved}
                  />
                )}
              </>
            ) : (
              <p className={`text-sm ${MUTED}`}>{tr("tplWhatsappOff", d)}</p>
            )}
          </NumberedSection>

          <NumberedSection
            number={3}
            title={tr("channelEmail", d)}
            subtitle={tr("tplSectionEmailHint", d)}
            changed={changes.includes("email")}
            actions={
              <ToggleSwitch
                checked={body.email !== null}
                disabled={!editable}
                label={tr("tplChannelOn", d)}
                onChange={toggleEmail}
              />
            }
          >
            {body.email ? (
              <>
                <TemplateTextField
                  label={tr("emailSubject", d)}
                  value={body.email.subject}
                  onChange={(subject) => setEmail({ subject })}
                  variables={variables}
                  known={known}
                  d={d}
                  readOnly={!editable}
                  multiline={false}
                  onFocusField={focus}
                />
                <TemplateTextField
                  label={tr("tplEmailHtml", d)}
                  value={body.email.html ?? ""}
                  onChange={(html) => setEmail({ body: null, html })}
                  variables={variables}
                  known={known}
                  d={d}
                  readOnly={!editable}
                  rows={14}
                  mono
                  hint={tr("tplEmailHtmlHint", d)}
                  onFocusField={focus}
                />
                {editable && body.whatsapp && body.baseText.trim() && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
                    onClick={() =>
                      setEmail({
                        body: null,
                        html: textToHtml(plainText(body.baseText)),
                      })
                    }
                  >
                    <HiOutlineDuplicate aria-hidden className="h-4 w-4" />
                    {tr("tplCopyText", d)}
                  </button>
                )}
              </>
            ) : (
              <p className={`text-sm ${MUTED}`}>{tr("tplEmailOff", d)}</p>
            )}
          </NumberedSection>

          <NumberedSection
            number={4}
            title={tr("tplSectionChats", d)}
            subtitle={tr("tplSectionChatsHint", d)}
            changed={body.whatsapp === null && changes.includes("baseText")}
          >
            {body.whatsapp ? (
              <p className={`text-sm ${MUTED}`}>
                {tr("tplChatsUseWhatsapp", d)}
              </p>
            ) : (
              <TemplateTextField
                label={tr("tplChatText", d)}
                value={body.baseText}
                onChange={(baseText) => set({ baseText })}
                variables={variables}
                known={known}
                d={d}
                readOnly={!editable}
                rows={4}
                placeholder={
                  body.email
                    ? tr("tplChatTextFromEmail", d)
                    : tr("baseTextPlaceholder", d)
                }
                onFocusField={focus}
              />
            )}
          </NumberedSection>
        </div>

        <div className="flex flex-col gap-4">
          <TemplateReviewPanel findings={findings} d={d} />
          <TemplatePreviewPanel
            body={body}
            values={examples}
            meta={meta}
            d={d}
          />
          <TemplateVariablesPanel
            variables={variables}
            examples={examples}
            eventPicked={Boolean(info)}
            d={d}
            onInsert={insert}
          />
          {template && <UsedByPanel template={template} lang={lang} d={d} />}
        </div>
      </div>
    </>
  );
}
