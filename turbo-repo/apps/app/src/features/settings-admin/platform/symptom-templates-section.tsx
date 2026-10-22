"use client";

import Link from "next/link";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { PLATFORM_TEMPLATES } from "@/features/symptoms/maintainer/symptom-scope";

/**
 * The platform's symptom templates. They are edited in the symptom editor, on
 * a page of their own, so this panel only says what they are and links there.
 */
export default function SymptomTemplatesSection({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {tr("title", dict)}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {tr("description", dict)}
      </p>
      <Link
        href={`/${lang}${PLATFORM_TEMPLATES.pages}`}
        className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
      >
        {tr("open", dict)}
      </Link>
    </section>
  );
}
