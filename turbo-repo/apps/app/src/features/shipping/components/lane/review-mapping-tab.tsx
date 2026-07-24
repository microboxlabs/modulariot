"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, TextInput } from "flowbite-react";
import { HiInformationCircle, HiPlus, HiArrowRight } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { Section } from "./review-config-tab";
import {
  buildSampleContext,
  renderTemplate,
  VARIABLE_GROUPS,
  type ChannelField,
  type ReviewChannelDescriptor,
  type TemplateVariable,
  type VariableGroup,
} from "./review-integration.types";

const SAMPLE_CONTEXT = buildSampleContext();

interface ReviewMappingTabProps {
  readonly channel: ReviewChannelDescriptor | undefined;
  readonly mappings: Record<string, string>;
  readonly onChange: (fieldId: string, template: string) => void;
  readonly dict: I18nRecord;
}

export function ReviewMappingTab({
  channel,
  mappings,
  onChange,
  dict,
}: Readonly<ReviewMappingTabProps>) {
  if (!channel) {
    return (
      <Alert color="gray" icon={HiInformationCircle}>
        <span className="text-xs">{tr("mapping.noChannel", dict)}</span>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title={tr("mapping.title", dict)} help={tr("mapping.help", dict)}>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLE_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <span
                key={group.id}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                <Icon className="h-3 w-3" />
                {trDynamic(group.labelKey, dict)}
                <code className="font-mono opacity-70">{`{{${group.id}}}`}</code>
              </span>
            );
          })}
        </div>
      </Section>

      <div className="flex flex-col gap-3">
        {channel.fields.map((field) => (
          <MappingField
            key={field.id}
            field={field}
            template={mappings[field.id] ?? ""}
            onChange={(value) => onChange(field.id, value)}
            dict={dict}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function MappingField({
  field,
  template,
  onChange,
  dict,
}: Readonly<{
  field: ChannelField;
  template: string;
  onChange: (value: string) => void;
  dict: I18nRecord;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const missing = field.required && !template.trim();
  const preview = useMemo(
    () => renderTemplate(template, SAMPLE_CONTEXT),
    [template]
  );

  function insertToken(path: string) {
    const token = `{{${path}}}`;
    const input = inputRef.current;
    const start = input?.selectionStart ?? template.length;
    const end = input?.selectionEnd ?? template.length;
    const next = template.slice(0, start) + token + template.slice(end);
    onChange(next);
    setPaletteOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      const caret = start + token.length;
      input?.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {trDynamic(field.labelKey, dict)}
        </span>
        <Badge color="gray" className="font-mono text-[10px]">
          {field.id}
        </Badge>
        <span className="text-[10px] text-gray-400">
          {tr(`mapping.types.${field.type}`, dict)}
        </span>
        <span
          className={`text-[10px] ${
            field.required
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-400"
          }`}
        >
          {field.required
            ? tr("mapping.required", dict)
            : tr("mapping.optional", dict)}
        </span>
      </div>

      <div className="relative flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TextInput
            ref={inputRef}
            sizing="sm"
            value={template}
            onChange={(e) => onChange(e.target.value)}
            placeholder={tr("mapping.templatePlaceholder", dict)}
            color={missing ? "failure" : "gray"}
            className="font-mono [&_input]:text-xs"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          color="light"
          size="xs"
          onClick={() => setPaletteOpen((open) => !open)}
          aria-expanded={paletteOpen}
        >
          <HiPlus className="mr-1 h-3 w-3" />
          {tr("mapping.insertVariable", dict)}
        </Button>
        {paletteOpen && (
          <VariablePalette
            onInsert={insertToken}
            onClose={() => setPaletteOpen(false)}
            dict={dict}
          />
        )}
      </div>

      {/* Live preview against sample data. */}
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        <HiArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
        {template.trim() ? (
          <code className="min-w-0 truncate font-mono text-gray-600 dark:text-gray-300">
            {preview || tr("mapping.previewEmpty", dict)}
          </code>
        ) : (
          <span className="text-gray-400">
            {missing
              ? tr("mapping.previewRequired", dict)
              : tr("mapping.previewUnset", dict)}
          </span>
        )}
      </div>
    </div>
  );
}

function VariablePalette({
  onInsert,
  onClose,
  dict,
}: Readonly<{
  onInsert: (path: string) => void;
  onClose: () => void;
  dict: I18nRecord;
}>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-9 z-50 max-h-72 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-600 dark:bg-gray-800"
    >
      {VARIABLE_GROUPS.map((group) => (
        <VariableGroupSection
          key={group.id}
          group={group}
          onInsert={onInsert}
          dict={dict}
        />
      ))}
    </div>
  );
}

function VariableGroupSection({
  group,
  onInsert,
  dict,
}: Readonly<{
  group: VariableGroup;
  onInsert: (path: string) => void;
  dict: I18nRecord;
}>) {
  const Icon = group.icon;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <Icon className="h-3 w-3" />
        {trDynamic(group.labelKey, dict)}
      </div>
      {group.variables.map((variable) => (
        <VariableRow
          key={variable.path}
          variable={variable}
          onInsert={onInsert}
          dict={dict}
        />
      ))}
    </div>
  );
}

function VariableRow({
  variable,
  onInsert,
  dict,
}: Readonly<{
  variable: TemplateVariable;
  onInsert: (path: string) => void;
  dict: I18nRecord;
}>) {
  return (
    <button
      type="button"
      onClick={() => onInsert(variable.path)}
      className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-xs text-gray-700 dark:text-gray-200">
          {trDynamic(variable.labelKey, dict)}
        </span>
        <code className="shrink-0 font-mono text-[10px] text-primary-600 dark:text-primary-300">
          {`{{${variable.path}}}`}
        </code>
      </span>
      <span className="truncate text-[10px] text-gray-400">
        {variable.sample}
      </span>
    </button>
  );
}
