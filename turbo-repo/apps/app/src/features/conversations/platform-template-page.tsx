"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiChevronLeft } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ago } from "@/features/symptoms/maintainer/catalog-format";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import {
  useConversationTemplate,
  useConversationTemplates,
} from "./conversations-api";
import {
  NEW_TEMPLATE,
  PLATFORM_TEMPLATES_PAGE,
  platformTemplateHref,
} from "./platform-templates-catalog";
import { TemplateEditor } from "./template-editor";

/** Comunicaciones › Plantillas › one template, or `NEW_TEMPLATE` to create one; platform scope. */
export default function PlatformTemplatePage({
  templateKey,
  dict,
  lang,
}: Readonly<{ templateKey: string; dict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const router = useRouter();
  const isNew = templateKey === NEW_TEMPLATE;
  const { data: template, error: templateError } = useConversationTemplate(
    isNew ? null : templateKey
  );
  // Saving is create-or-replace: a new template waits for the taken keys.
  const { data: all, error: listError } = useConversationTemplates(isNew);
  const error = isNew ? listError : templateError;
  const backHref = `/${lang}${PLATFORM_TEMPLATES_PAGE}`;
  const ready = isNew ? all !== undefined : template;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "communications"]}
          disableLinks
        />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-screen-xl flex-1 flex-col gap-4 overflow-y-auto px-4 pb-10 pt-3 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <Link
            href={backHref}
            aria-label={tr("backToTemplates", d)}
            title={tr("backToTemplates", d)}
            className={`mt-1.5 rounded p-1 ${MUTED} hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white`}
          >
            <HiChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold text-gray-900 dark:text-white">
              {isNew ? tr("newTemplate", d) : (template?.name ?? templateKey)}
            </h1>
            {template && (
              <p className={`mt-1 flex flex-wrap gap-2 text-xs ${MUTED}`}>
                <span className="font-mono">{template.key}</span>
                {template.version && (
                  <>
                    <span>·</span>
                    <span className="font-mono">v{template.version}</span>
                  </>
                )}
                {template.updatedAt && (
                  <>
                    <span>·</span>
                    <span>{ago(template.updatedAt, lang)}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {tr("loadFailed", d)}
          </p>
        )}
        {!ready && !error && (
          <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>
        )}
        {ready && (
          <TemplateEditor
            key={template?.version ?? templateKey}
            template={template ?? null}
            readOnly={false}
            takenKeys={(all ?? []).map((t) => t.key)}
            lang={lang}
            d={d}
            onSaved={(saved) => {
              if (isNew) router.replace(platformTemplateHref(lang, saved.key));
            }}
          />
        )}
      </div>
    </div>
  );
}
