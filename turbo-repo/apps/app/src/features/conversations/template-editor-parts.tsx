"use client";

import Link from "next/link";
import {
  HiCheckCircle,
  HiExclamation,
  HiInformationCircle,
  HiXCircle,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { Panel } from "@/features/symptoms/maintainer/symptom-side-panels";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { FIELD } from "@/features/symptoms/maintainer/ui/response-block";
import Select from "@/features/symptoms/maintainer/ui/select";
import { StatePill } from "@/features/symptoms/maintainer/ui/state";
import type {
  ConversationTemplate,
  EventField,
  EventTypeInfo,
  MetaTemplate,
  WhatsAppVariant,
} from "./conversations-types";
import MetaStatusChip from "./meta-template-status";
import { ruleHref } from "./rules-tab";
import type { FindingSeverity, TemplateFinding } from "./template-model";

const ICON = "mt-0.5 h-3.5 w-3.5 shrink-0";

function FindingIcon({ severity }: Readonly<{ severity: FindingSeverity }>) {
  if (severity === "error")
    return <HiXCircle aria-hidden className={`${ICON} text-red-500`} />;
  if (severity === "warning")
    return <HiExclamation aria-hidden className={`${ICON} text-yellow-500`} />;
  return (
    <HiInformationCircle aria-hidden className={`${ICON} text-blue-500`} />
  );
}

/** The checks: whether the template can be saved, and what would stop a send. */
export function TemplateReviewPanel({
  findings,
  d,
}: Readonly<{ findings: TemplateFinding[]; d: I18nRecord }>) {
  const errors = findings.filter((f) => f.severity === "error").length;
  const ok = errors === 0;
  return (
    <Panel title={tr("review", d)}>
      <p
        className={`flex items-center gap-1.5 text-sm font-medium ${ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
      >
        {ok ? (
          <HiCheckCircle aria-hidden className="h-4 w-4" />
        ) : (
          <HiXCircle aria-hidden className="h-4 w-4" />
        )}
        {ok ? tr("tplReady", d) : tr("tplErrors", d, { n: String(errors) })}
      </p>
      {findings.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {findings.map((f) => (
            <li
              key={`${f.section}-${f.key}`}
              className="flex gap-1.5 text-xs text-gray-700 dark:text-gray-300"
            >
              <FindingIcon severity={f.severity} />
              {trDynamic(f.key, d, f.values)}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** The variables the event gives, with the example the preview uses; a click inserts one at the cursor. */
export function TemplateVariablesPanel({
  variables,
  examples,
  eventPicked,
  readOnly,
  d,
  onInsert,
}: Readonly<{
  variables: EventField[];
  examples: Record<string, string>;
  eventPicked: boolean;
  readOnly: boolean;
  d: I18nRecord;
  onInsert: (name: string) => void;
}>) {
  return (
    <Panel title={tr("tplVariables", d)}>
      <p className={`mb-2 text-xs ${MUTED}`}>
        {eventPicked ? tr("tplVariablesHint", d) : tr("tplVariablesCommon", d)}
      </p>
      <ul className="flex flex-col gap-0.5">
        {variables.map((v) => (
          <li key={v.name}>
            <button
              type="button"
              disabled={readOnly}
              title={v.description ?? undefined}
              className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInsert(v.name)}
            >
              <span className="shrink-0 font-mono text-gray-900 dark:text-gray-100">
                {`{{${v.name}}}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-500 dark:text-gray-400">
                {v.label}
              </span>
              <span className="max-w-28 shrink-0 truncate font-mono text-[11px] text-gray-400">
                {examples[v.name]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function UsedByRow({
  rule,
  lang,
  d,
}: Readonly<{
  rule: NonNullable<ConversationTemplate["usedBy"]>[number];
  lang: string;
  d: I18nRecord;
}>) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <StatePill state={rule.state} d={d} />
      {rule.tenantCode ? (
        // The platform sees other organizations' rules; their editor is in each organization.
        <>
          <span className="text-gray-900 dark:text-white">{rule.name}</span>
          <span className={`font-mono text-xs ${MUTED}`}>
            {rule.tenantCode}
          </span>
        </>
      ) : (
        <Link
          href={ruleHref(lang, rule.id)}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          {rule.name}
        </Link>
      )}
    </li>
  );
}

export function UsedByPanel({
  template,
  lang,
  d,
}: Readonly<{
  template: ConversationTemplate;
  lang: string;
  d: I18nRecord;
}>) {
  const rules = template.usedBy ?? [];
  return (
    <Panel title={tr("usedBy", d)}>
      {rules.length === 0 ? (
        <p className={`text-xs ${MUTED}`}>{tr("usedByNone", d)}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <UsedByRow key={r.id} rule={r} lang={lang} d={d} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function metaStatusText(
  variant: WhatsAppVariant,
  meta: MetaTemplate | null,
  templates: MetaTemplate[] | undefined,
  d: I18nRecord
): string {
  if (!templates) return tr("tplMetaUnreadable", d);
  if (!meta) return tr("tplMetaMissing", d, { name: variant.metaName });
  if (meta.status === "APPROVED") return tr("tplMetaApproved", d);
  if (meta.status === "PENDING") return tr("tplMetaPending", d);
  if (meta.status === "REJECTED")
    return tr("tplMetaRejected", d, { reason: meta.rejectedReason ?? "—" });
  return tr("metaNotApproved", d);
}

/** Where the WhatsApp version stands on Meta, in one line. */
export function MetaStatusLine({
  variant,
  meta,
  templates,
  d,
}: Readonly<{
  variant: WhatsAppVariant;
  meta: MetaTemplate | null;
  templates: MetaTemplate[] | undefined;
  d: I18nRecord;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      {meta ? (
        <MetaStatusChip status={meta.status} d={d} />
      ) : (
        <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {tr("tplMetaNotSent", d)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {metaStatusText(variant, meta, templates, d)}
      </span>
    </div>
  );
}

/** The event whose variables the editor offers: the ones the template's rules listen to first. */
export function EventSelect({
  value,
  catalog,
  used,
  d,
  onChange,
}: Readonly<{
  value: string;
  catalog: EventTypeInfo[] | undefined;
  used: string[];
  d: I18nRecord;
  onChange: (event: string) => void;
}>) {
  const label = (type: string) => {
    const e = catalog?.find((c) => c.type === type);
    return e?.description ? `${e.description} · ${type}` : type;
  };
  const others = (catalog ?? [])
    .map((e) => e.type)
    .filter((t) => !used.includes(t));
  return (
    <Select
      aria-label={tr("tplEvent", d)}
      className={FIELD}
      wrapperClassName="w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{tr("tplEventNone", d)}</option>
      {used.length > 0 && (
        <optgroup label={tr("tplEventUsed", d)}>
          {used.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={tr("tplEventAll", d)}>
        {others.map((t) => (
          <option key={t} value={t}>
            {label(t)}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}
