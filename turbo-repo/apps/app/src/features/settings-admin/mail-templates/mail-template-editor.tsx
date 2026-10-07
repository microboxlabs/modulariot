"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  Label,
  Spinner,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiOutlineTemplate } from "react-icons/hi";
import { toast } from "sonner";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import {
  insertVariable,
  isOwnTemplate,
  sourceKey,
  TEMPLATE_LANGS,
  type MailTemplate,
  type MailTemplatePreview,
  type SaveMailTemplate,
  type TemplateLang,
  type TemplateScope,
} from "./mail-template-model";
import { useMailTemplate } from "./use-mail-template";

const PREVIEW_DELAY_MS = 400;

interface MailTemplateEditorProps {
  readonly scope: TemplateScope;
  /** `pages.userSettings.mailTemplates` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** The server's reason, with the missing-link case in the user's language. */
function errorMessage(err: unknown, fallback: string, dict: I18nRecord) {
  if (!(err instanceof ApiError)) return fallback;
  return err.message.includes("{{link}}")
    ? tr("linkRequired", dict)
    : err.message;
}

/**
 * The invitation email template for the platform or the active organization:
 * subject and HTML body in Handlebars, one per language, with a live preview.
 */
export default function MailTemplateEditor({
  scope,
  dict,
  lang,
}: MailTemplateEditorProps) {
  const [templateLang, setTemplateLang] = useState<TemplateLang>(
    lang === "en" ? "en" : "es"
  );
  const { template, isLoading, error, save, reset, preview } = useMailTemplate(
    scope,
    templateLang
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HiOutlineTemplate className="h-5 w-5 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr("title", dict)}
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {scope === "platform"
              ? tr("platformDescription", dict)
              : tr("organizationDescription", dict)}
          </p>
        </div>
        <ButtonGroup>
          {TEMPLATE_LANGS.map((option) => (
            <Button
              key={option}
              size="xs"
              color={option === templateLang ? "blue" : "alternative"}
              onClick={() => setTemplateLang(option)}
            >
              {trDynamic(`lang_${option}`, dict)}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error.status === 409
            ? tr("subAccount", dict)
            : tr("loadError", dict)}
        </p>
      )}
      {template && (
        <TemplateForm
          key={`${templateLang}:${template.source}:${template.updatedAt ?? ""}`}
          scope={scope}
          template={template}
          dict={dict}
          lang={lang}
          save={save}
          reset={reset}
          preview={preview}
        />
      )}
    </section>
  );
}

interface TemplateFormProps {
  readonly scope: TemplateScope;
  readonly template: MailTemplate;
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly save: (value: SaveMailTemplate) => Promise<void>;
  readonly reset: () => Promise<void>;
  readonly preview: (value: SaveMailTemplate) => Promise<MailTemplatePreview>;
}

function TemplateForm({
  scope,
  template,
  dict,
  lang,
  save,
  reset,
  preview,
}: TemplateFormProps) {
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [rendered, setRendered] = useState<MailTemplatePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  const own = isOwnTemplate(scope, template);
  const dirty = subject !== template.subject || html !== template.html;

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      preview({ subject, html })
        .then((result) => {
          if (!current) return;
          setRendered(result);
          setPreviewError(null);
        })
        .catch((err: unknown) => {
          if (current) {
            setPreviewError(errorMessage(err, tr("previewError", dict), dict));
          }
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [subject, html, preview, dict]);

  const insert = (name: string) => {
    const el = body.current;
    const next = insertVariable(
      html,
      name,
      el?.selectionStart ?? html.length,
      el?.selectionEnd ?? html.length
    );
    setHtml(next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      await save({ subject, html });
      toast.success(tr("saved", dict));
    } catch (err) {
      toast.error(errorMessage(err, tr("saveError", dict), dict));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await reset();
      setConfirmReset(false);
      toast.success(tr("resetDone", dict));
    } catch (err) {
      toast.error(errorMessage(err, tr("resetError", dict), dict));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <SourceLine scope={scope} template={template} dict={dict} lang={lang} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="mail-template-subject">{tr("subject", dict)}</Label>
            <TextInput
              id="mail-template-subject"
              sizing="sm"
              value={subject}
              disabled={busy}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {tr("variables", dict)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={busy}
                  title={trDynamic(`variable_${name}`, dict)}
                  className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-700 hover:border-blue-400 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:text-blue-300"
                  onClick={() => insert(name)}
                >
                  {`{{${name}}}`}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("variablesHint", dict)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mail-template-body">{tr("body", dict)}</Label>
            <Textarea
              id="mail-template-body"
              ref={body}
              rows={22}
              spellCheck={false}
              disabled={busy}
              className="font-mono text-xs"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("bodyHint", dict)}
            </span>
          </div>
        </div>
        <PreviewPane rendered={rendered} error={previewError} dict={dict} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          color="blue"
          size="sm"
          disabled={busy || !dirty}
          onClick={submit}
        >
          {tr("save", dict)}
        </Button>
        <Button
          color="alternative"
          size="sm"
          disabled={busy || !dirty}
          onClick={() => {
            setSubject(template.subject);
            setHtml(template.html);
          }}
        >
          {tr("discard", dict)}
        </Button>
        {own && (
          <Button
            color="alternative"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmReset(true)}
          >
            {tr("reset", dict)}
          </Button>
        )}
      </div>
      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={restore}
        isProcessing={busy}
        variant="danger"
        title={tr("resetTitle", dict)}
        description={
          scope === "platform"
            ? tr("resetBodyPlatform", dict)
            : tr("resetBodyOrganization", dict)
        }
        confirmLabel={tr("reset", dict)}
      />
    </div>
  );
}

interface SourceLineProps {
  readonly scope: TemplateScope;
  readonly template: MailTemplate;
  readonly dict: I18nRecord;
  readonly lang: string;
}

function SourceLine({ scope, template, dict, lang }: SourceLineProps) {
  const key = sourceKey(scope, template);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <Badge color={key === "sourceOwn" ? "blue" : "gray"}>
        {trDynamic(key, dict)}
      </Badge>
      {key === "sourceOwn" && template.updatedAt && (
        <span>
          {tr("updated", dict, {
            by: template.updatedBy ?? "—",
            date: new Date(template.updatedAt).toLocaleString(lang),
          })}
        </span>
      )}
    </div>
  );
}

interface PreviewPaneProps {
  readonly rendered: MailTemplatePreview | null;
  readonly error: string | null;
  readonly dict: I18nRecord;
}

function PreviewPane({ rendered, error, dict }: PreviewPaneProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {tr("preview", dict)}
      </span>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200">
          <span className="font-medium">{tr("previewSubject", dict)}</span>{" "}
          {rendered?.subject ?? ""}
        </div>
        {rendered ? (
          <iframe
            title={tr("preview", dict)}
            sandbox=""
            srcDoc={rendered.html}
            className={`h-[560px] w-full bg-white ${error ? "opacity-40" : ""}`}
          />
        ) : (
          <div className="flex h-[560px] items-center justify-center bg-white">
            <Spinner size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
