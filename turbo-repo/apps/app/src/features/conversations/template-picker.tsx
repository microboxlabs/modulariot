"use client";

import { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { HiCheck, HiChevronDown } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ChannelIcon from "./channel-icon";
import { useConversationTemplates } from "./conversations-api";
import type { ConversationTemplate, MetaTemplate } from "./conversations-types";
import { findMetaTemplate } from "./meta-template-combobox";
import MetaTemplatePreview from "./meta-template-preview";
import { fillText } from "./rule-model";
import { htmlToText, SAMPLE_VALUES } from "./template-model";

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The templates whose name, key or text contain every word of the query. */
export function matchStepTemplates(
  templates: ConversationTemplate[],
  query: string
): ConversationTemplate[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return templates;
  return templates.filter((t) => {
    const text = fold(`${t.name} ${t.key} ${t.baseText}`);
    return words.every((w) => text.includes(w));
  });
}

/** Whether the template has what the channel sends: its Meta template, its email, or its base text. */
export function templateFits(
  t: ConversationTemplate,
  channel: string
): boolean {
  if (channel === "whatsapp") return t.whatsapp !== null;
  if (channel === "email") return t.email !== null;
  if (channel === "preferred") return t.whatsapp !== null && t.email !== null;
  return true;
}

function Filled({ text }: Readonly<{ text: string }>) {
  return (
    <>
      {fillText(text, SAMPLE_VALUES).map((p, i) => {
        const k = `${i}-${"text" in p ? p.text : p.variable}`;
        if ("text" in p) return <span key={k}>{p.text}</span>;
        return p.value === null ? (
          <span
            key={k}
            className="rounded bg-gray-200 px-1 font-mono text-xs text-gray-700 dark:bg-gray-600 dark:text-gray-200"
          >{`{{${p.variable}}}`}</span>
        ) : (
          <span key={k} className="font-medium">
            {p.value}
          </span>
        );
      })}
    </>
  );
}

function EmailPreview({
  template,
  connection = false,
}: Readonly<{ template: ConversationTemplate; connection?: boolean }>) {
  const email = template.email;
  const text = connection
    ? connectionPreviewText(template)
    : email?.body || htmlToText(email?.html ?? "") || template.baseText || "—";
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <p className="border-b border-gray-200 px-3 py-2 font-medium text-gray-900 dark:border-gray-700 dark:text-white">
        <Filled text={email?.subject || template.name} />
      </p>
      <p className="whitespace-pre-wrap break-words px-3 py-2">
        <Filled text={text || "—"} />
      </p>
    </div>
  );
}

function connectionPreviewText(template: ConversationTemplate): string {
  const email = template.email;
  if (email && !email.html?.trim()) return email.body ?? "";
  if (template.baseText?.trim()) return template.baseText;
  return htmlToText(email?.html ?? "");
}

function WhatsAppPreview({
  template,
  meta,
  d,
}: Readonly<{
  template: ConversationTemplate;
  meta: MetaTemplate[];
  d: I18nRecord;
}>) {
  const wa = template.whatsapp;
  const found = wa ? findMetaTemplate(meta, wa.metaName, wa.language) : null;
  if (found)
    return (
      <MetaTemplatePreview
        label={tr("templatePreviewLabel", d)}
        draft={{
          name: found.name,
          language: found.language,
          category: "UTILITY",
          header: found.header ?? "",
          body: found.body ?? "",
          footer: found.footer ?? "",
          buttons: found.buttons,
          examples: found.examples,
        }}
      />
    );
  return (
    <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
      <p className="max-w-sm whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100">
        <Filled text={template.baseText || "—"} />
      </p>
      {wa && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {tr("templateMetaNotFound", d, { name: wa.metaName })}
        </p>
      )}
    </div>
  );
}

type PreviewPart = "whatsapp" | "email" | "base";

function previewParts(
  template: ConversationTemplate,
  channel: string
): PreviewPart[] {
  if (channel === "whatsapp") return ["whatsapp"];
  if (channel === "email") return ["email"];
  if (channel === "preferred") return ["whatsapp", "email"];
  return template.email ? ["email"] : ["base"];
}

/** The message a step sends with the template, drawn as its channel shows it, with sample values. */
export function TemplatePreview({
  template,
  channel,
  meta,
  d,
}: Readonly<{
  template: ConversationTemplate;
  channel: string;
  meta: MetaTemplate[];
  d: I18nRecord;
}>) {
  const parts = previewParts(template, channel);
  const connection = !["email", "whatsapp", "preferred"].includes(channel);
  return (
    <div className="flex flex-col gap-3">
      {parts.map((p) => (
        <div key={p} className="flex items-start gap-2">
          {p !== "base" && (
            <ChannelIcon channel={connection ? channel : p} size={6} />
          )}
          <div className="min-w-0 flex-1">
            {p !== "base" && template[p] === null && (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                {p === "whatsapp"
                  ? tr("templateNoWhatsapp", d)
                  : tr("templateNoEmail", d)}
              </p>
            )}
            {p === "whatsapp" && template.whatsapp && (
              <WhatsAppPreview template={template} meta={meta} d={d} />
            )}
            {p === "email" && template.email && (
              <EmailPreview template={template} connection={connection} />
            )}
            {p === "base" && (
              <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                <Filled text={template.baseText || "—"} />
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Variants({ t }: Readonly<{ t: ConversationTemplate }>) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {t.whatsapp && <ChannelIcon channel="whatsapp" size={4} />}
      {t.email && <ChannelIcon channel="email" size={4} />}
    </span>
  );
}

/**
 * A step's template: a pill that searches the templates by name, key or text, with a preview of the one
 * under the pointer, or the chosen one, as the step's channel sends it.
 */
export default function TemplatePicker({
  value,
  templates,
  channel,
  meta,
  emptyLabel,
  invalid,
  readOnly,
  d,
  onChange,
}: Readonly<{
  value: string;
  templates: ConversationTemplate[];
  channel: string;
  meta: MetaTemplate[];
  /** The option without a template; "Sin plantilla" where the template is optional. */
  emptyLabel: string;
  invalid: boolean;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (key: string) => void;
}>) {
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  // The same request the editor made: a failed list is not a list without templates for the channel.
  const { error: loadError } = useConversationTemplates();
  const current = templates.find((t) => t.key === value);
  // Only templates the channel can send; the chosen one stays listed so it can be seen and replaced.
  const usable = templates.filter(
    (t) => templateFits(t, channel) || t.key === value
  );
  const matches = matchStepTemplates(usable, query);
  const noMatchMessage =
    usable.length === 0
      ? tr("templateNoneForChannel", d)
      : tr("templateNoMatch", d);
  const emptyMessage =
    loadError && templates.length === 0
      ? tr("templatesLoadFailed", d)
      : noMatchMessage;
  const shown =
    templates.find((t) => t.key === hovered) ?? current ?? matches[0] ?? null;
  return (
    <Combobox
      value={value}
      onChange={(key: string | null) => {
        if (key !== null) onChange(key);
      }}
      onClose={() => {
        setQuery("");
        setHovered(null);
      }}
      disabled={readOnly}
      immediate
    >
      <div
        className={`relative inline-flex items-center rounded-md border bg-gray-50 font-medium text-gray-900 hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-gray-700 dark:text-white ${
          invalid ? "border-red-500" : "border-gray-300 dark:border-gray-600"
        }`}
      >
        <ComboboxInput
          aria-label={tr("stepTemplate", d)}
          placeholder={emptyLabel}
          displayValue={() => current?.name ?? value}
          onChange={(e) => setQuery(e.target.value)}
          className="w-52 border-0 bg-transparent py-0.5 pl-2 pr-6 text-sm outline-none placeholder:text-gray-900 focus:ring-0 dark:placeholder:text-white"
        />
        <ComboboxButton
          aria-label={tr("templateList", d)}
          className="absolute inset-y-0 right-0 flex items-center pr-1.5 text-gray-500"
        >
          <HiChevronDown className="h-4 w-4" />
        </ComboboxButton>
      </div>
      {/* A fixed height: a panel sized by the hovered preview moves under the pointer, which hovers another
          option, and the panel shakes. */}
      <ComboboxOptions
        anchor={{ to: "bottom start", gap: 4, padding: 16 }}
        className="z-[60] flex h-[min(26rem,60vh)] w-[44rem] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white text-sm shadow-lg [--anchor-max-height:min(26rem,60vh)] dark:border-gray-600 dark:bg-gray-800"
      >
        <div className="w-64 shrink-0 overflow-y-auto border-r border-gray-200 py-1 dark:border-gray-700">
          <ComboboxOption
            value=""
            onMouseEnter={() => setHovered(null)}
            className="group flex cursor-default items-center gap-2 px-3 py-1.5 text-gray-500 data-[focus]:bg-gray-100 dark:text-gray-400 dark:data-[focus]:bg-gray-700"
          >
            <span className="flex-1">{emptyLabel}</span>
            <HiCheck className="invisible h-4 w-4 text-blue-600 group-data-[selected]:visible" />
          </ComboboxOption>
          {matches.length === 0 && (
            <p className="px-3 py-2 text-gray-500 dark:text-gray-400">
              {emptyMessage}
            </p>
          )}
          {matches.map((t) => (
            <ComboboxOption
              key={t.key}
              value={t.key}
              onMouseEnter={() => setHovered(t.key)}
              className={`group flex cursor-default items-start gap-2 px-3 py-1.5 data-[focus]:bg-gray-100 dark:data-[focus]:bg-gray-700 ${
                templateFits(t, channel)
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{t.name}</span>
                  <Variants t={t} />
                </span>
                <span className="block truncate font-mono text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                  {t.key}
                </span>
              </span>
              <HiCheck className="invisible mt-0.5 h-4 w-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
            </ComboboxOption>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-3">
          {shown ? (
            <TemplatePreview
              template={shown}
              channel={channel}
              meta={meta}
              d={d}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          )}
        </div>
      </ComboboxOptions>
    </Combobox>
  );
}
