"use client";

import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
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
      <div className="min-h-0 flex-1 overflow-y-auto dark:bg-gray-900">
        {error && (
          <p
            role="alert"
            className="mx-auto max-w-screen-2xl px-4 pt-3 text-sm text-red-600 dark:text-red-400"
          >
            {tr("loadFailed", d)}
          </p>
        )}
        {!ready && !error && (
          <p className={`mx-auto max-w-screen-2xl px-4 pt-3 text-sm ${MUTED}`}>
            {tr("loading", d)}
          </p>
        )}
        {ready && (
          <TemplateEditor
            key={template?.version ?? templateKey}
            template={template ?? null}
            readOnly={false}
            takenKeys={(all ?? []).map((t) => t.key)}
            lang={lang}
            d={d}
            backHref={backHref}
            onSaved={(saved) => {
              if (isNew) router.replace(platformTemplateHref(lang, saved.key));
            }}
          />
        )}
      </div>
    </div>
  );
}
