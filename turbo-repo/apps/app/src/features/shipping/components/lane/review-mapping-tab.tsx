"use client";

import { useMemo } from "react";
import { Alert } from "flowbite-react";
import { HiInformationCircle, HiArrowRight, HiExclamationCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { Section } from "./review-config-tab";
import {
  buildSampleContext,
  renderTemplate,
  VARIABLE_GROUPS,
} from "./review-integration.types";
import { checkTemplate } from "./review-template-validation";
import { ReviewTemplateInput } from "./review-template-input";
import type { DispatchTarget, DispatchTargetField } from "./review-binding.types";

const SAMPLE_CONTEXT = buildSampleContext();

interface ReviewMappingTabProps {
  /** The chosen channel; its operation contract supplies the fields to map. */
  readonly target: DispatchTarget | undefined;
  readonly mappings: Record<string, string>;
  readonly onChange: (fieldId: string, template: string) => void;
  readonly dict: I18nRecord;
}

export function ReviewMappingTab({
  target,
  mappings,
  onChange,
  dict,
}: Readonly<ReviewMappingTabProps>) {
  if (!target) {
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
                {/* `.*` because a bare {{task}} is a whole object, which the server rejects. */}
                <code className="font-mono opacity-70">{`{{${group.id}.*}}`}</code>
              </span>
            );
          })}
        </div>
      </Section>

      <div className="flex flex-col gap-3">
        {target.fields.map((field) => (
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
  field: DispatchTargetField;
  template: string;
  onChange: (value: string) => void;
  dict: I18nRecord;
}>) {
  const check = useMemo(() => checkTemplate(template), [template]);
  const preview = useMemo(
    () => renderTemplate(template, SAMPLE_CONTEXT),
    [template]
  );

  const missing = field.required && !template.trim();
  const broken = check.status === "invalid";

  let color: "gray" | "success" | "failure" = "gray";
  if (missing || broken) {
    color = "failure";
  } else if (check.status === "valid") {
    color = "success";
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
          {field.id}
        </span>
        <span className="text-[10px] text-gray-400">
          {trDynamic(`mapping.types.${field.type}`, dict)}
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

      <ReviewTemplateInput
        value={template}
        onChange={onChange}
        placeholder={tr("mapping.templatePlaceholder", dict)}
        color={color}
      />

      {/* Why the server would refuse this template, in its own terms. */}
      {check.problem && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <HiExclamationCircle className="mt-px h-3 w-3 shrink-0" />
          <span>
            {trDynamic(
              `mapping.errors.${check.problem.code}`,
              dict,
              check.problem.params
            )}
          </span>
        </p>
      )}

      {/* Live preview against sample data — withheld while the template is broken,
          since rendering a template that cannot be stored only misleads. */}
      {!broken && (
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
      )}
    </div>
  );
}
