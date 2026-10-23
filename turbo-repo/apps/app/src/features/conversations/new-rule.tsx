"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "flowbite-react";
import { HiChevronLeft } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { keyFrom } from "@/features/symptoms/maintainer/create-symptom-modal";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import {
  FIELD,
  FieldRow,
  ResponseBlock,
} from "@/features/symptoms/maintainer/ui/response-block";
import { createRule, refreshRules, useEventCatalog } from "./conversations-api";
import { newRuleSpec, SYMPTOM_OPENED, triggerSummary } from "./rule-model";
import { COMMUNICATIONS_PAGE, ruleHref } from "./rules-tab";
import { useSymptomNames } from "./use-symptom-names";

/** The link that opens a new rule with its trigger filled in. */
export function newRuleHref(
  lang: string,
  prefill: { event?: string; when?: string; name?: string } = {}
) {
  const q = new URLSearchParams();
  if (prefill.event) q.set("event", prefill.event);
  if (prefill.when) q.set("when", prefill.when);
  if (prefill.name) q.set("name", prefill.name);
  const query = q.toString();
  return `/${lang}${COMMUNICATIONS_PAGE}/rules/new${query ? `?${query}` : ""}`;
}

/** "Nueva regla": a name, then the editor with a draft. The trigger may come in the link. */
export default function NewRule({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const router = useRouter();
  const params = useSearchParams();
  const event = params.get("event") || SYMPTOM_OPENED;
  const when = params.get("when") ?? "";
  const [name, setName] = useState(params.get("name") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: catalog } = useEventCatalog();
  const symptomName = useSymptomNames();
  const spec = newRuleSpec(event, when);
  const key = keyFrom(name);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createRule({ key, name: name.trim(), spec });
      await refreshRules();
      router.replace(ruleHref(lang, created.rule.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

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
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-10 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <Link
            href={`/${lang}${COMMUNICATIONS_PAGE}`}
            aria-label={tr("backToRules", d)}
            title={tr("backToRules", d)}
            className={`rounded p-1 ${MUTED} hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white`}
          >
            <HiChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {tr("newRule", d)}
          </h1>
        </div>
        <ResponseBlock title={tr("newRuleTitle", d)}>
          <FieldRow label={tr("ruleName", d)}>
            <input
              aria-label={tr("ruleName", d)}
              className={`${FIELD} min-w-48 flex-1`}
              maxLength={200}
              placeholder={tr("ruleNamePlaceholder", d)}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FieldRow>
          <FieldRow label={tr("ruleKey", d)}>
            <span className="font-mono text-gray-500 dark:text-gray-400">
              {key || "—"}
            </span>
          </FieldRow>
          <FieldRow label={tr("eventLabel", d)}>
            <span>{triggerSummary(spec.trigger, d, symptomName, catalog)}</span>
          </FieldRow>
          {when && (
            <FieldRow label={tr("whenLabel", d)}>
              <code className="break-all font-mono text-xs text-gray-700 dark:text-gray-300">
                {when}
              </code>
            </FieldRow>
          )}
          <p className={`text-sm ${MUTED}`}>{tr("newRuleHint", d)}</p>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              color="alternative"
              as={Link}
              href={`/${lang}${COMMUNICATIONS_PAGE}`}
            >
              {tr("cancel", d)}
            </Button>
            <Button
              disabled={busy || key.length < 2}
              onClick={() => void create()}
            >
              {busy ? tr("creating", d) : tr("createRule", d)}
            </Button>
          </div>
        </ResponseBlock>
      </div>
    </div>
  );
}
