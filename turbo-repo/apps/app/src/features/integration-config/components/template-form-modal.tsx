"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, Textarea, TextInput } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HiOutlineTemplate } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  HTTP_METHODS,
  PROVIDER_TYPES,
  TemplateFormSchema,
  parseJsonObject,
  schemaLeafPaths,
  type CreateTemplateRequest,
  type IntegrationTemplate,
  type TemplateFormData,
} from "../integration-config.types";
import { IntegrationFormModal } from "./integration-form-modal";

interface TemplateFormModalProps {
  readonly show: boolean;
  readonly template: IntegrationTemplate | undefined;
  readonly onClose: () => void;
  readonly onSave: (
    body: CreateTemplateRequest,
    id?: string
  ) => Promise<unknown>;
  /** Delete this template — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  readonly saving: boolean;
  readonly dict: I18nRecord;
}

const SCHEMA_PLACEHOLDER = `{
  "type": "object",
  "properties": {
    "reference": { "type": "string" },
    "approved": { "type": "boolean" }
  },
  "required": ["reference"]
}`;

const DEFAULTS: TemplateFormData = {
  name: "",
  providerType: PROVIDER_TYPES[0],
  operationName: "",
  method: HTTP_METHODS[0],
  path: "",
  requestSchemaText: "",
};

/**
 * Create/edit form for a template — the reusable type.
 *
 * The payload schema is the point of the screen: it is the contract every connection
 * made from this template copies, and the field list the review process maps against,
 * so the detected leaves are echoed back as they're typed.
 */
export function TemplateFormModal({
  show,
  template,
  onClose,
  onSave,
  onDelete,
  saving,
  dict,
}: Readonly<TemplateFormModalProps>) {
  const isEdit = template !== undefined;
  const [error, setError] = useState<Error | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(TemplateFormSchema),
    defaultValues: DEFAULTS,
  });

  const requestSchemaText = watch("requestSchemaText");

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    if (!show) return;
    setError(null);
    reset(
      template
        ? {
            name: template.name,
            providerType: template.providerType,
            operationName: template.operationName,
            method: template.method,
            path: template.path,
            requestSchemaText:
              Object.keys(template.requestSchema ?? {}).length > 0
                ? JSON.stringify(template.requestSchema, null, 2)
                : "",
          }
        : DEFAULTS
    );
  }, [show, template, reset]);

  const leaves = useMemo(() => {
    const parsed = parseJsonObject(requestSchemaText ?? "");
    return "value" in parsed ? schemaLeafPaths(parsed.value) : [];
  }, [requestSchemaText]);

  async function submit(data: TemplateFormData) {
    const parsed = parseJsonObject(data.requestSchemaText);
    if ("error" in parsed) return; // the resolver already flagged the field
    setError(null);
    try {
      await onSave(
        {
          name: data.name.trim(),
          providerType: data.providerType,
          operationName: data.operationName.trim(),
          method: data.method,
          path: data.path.trim(),
          requestSchema: parsed.value,
          responseSchema: {},
        },
        template?.id
      );
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error(tr("common.saveFailed", dict))
      );
    }
  }

  return (
    <IntegrationFormModal
      show={show}
      isEdit={isEdit}
      title={
        isEdit
          ? tr("template.form.editTitle", dict)
          : tr("template.form.createTitle", dict)
      }
      subtitle={tr("template.form.subtitle", dict)}
      glyph={<HiOutlineTemplate className="h-5 w-5" />}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={handleSubmit(submit)}
      error={error}
      saving={saving}
      dict={dict}
    >
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
          <SettingsFormField
            id="template-name"
            label={tr("template.form.name", dict)}
            error={trDynamic(errors.name?.message ?? "", dict)}
          >
            <TextInput
              id="template-name"
              placeholder={tr("template.form.namePlaceholder", dict)}
              {...register("name")}
              color={errors.name ? "failure" : undefined}
            />
          </SettingsFormField>

          <SettingsFormField
            id="template-provider"
            label={tr("template.form.providerType", dict)}
          >
            {/* Fixed after creation: connections already copied their operation from it. */}
            <Select
              id="template-provider"
              disabled={isEdit}
              {...register("providerType")}
            >
              {PROVIDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </SettingsFormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr]">
          <SettingsFormField
            id="template-method"
            label={tr("template.form.method", dict)}
          >
            <Select id="template-method" {...register("method")}>
              {HTTP_METHODS.map((verb) => (
                <option key={verb} value={verb}>
                  {verb}
                </option>
              ))}
            </Select>
          </SettingsFormField>

          <SettingsFormField
            id="template-path"
            label={tr("template.form.path", dict)}
            error={trDynamic(errors.path?.message ?? "", dict)}
          >
            <TextInput
              id="template-path"
              className="font-mono [&_input]:text-sm"
              placeholder="/api/v1/resource"
              {...register("path")}
              color={errors.path ? "failure" : undefined}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {tr("template.form.pathHelp", dict)}
            </p>
          </SettingsFormField>
        </div>

        <SettingsFormField
          id="template-operation"
          label={tr("template.form.operationName", dict)}
        >
          <TextInput
            id="template-operation"
            placeholder={tr("template.form.operationNamePlaceholder", dict)}
            {...register("operationName")}
          />
        </SettingsFormField>

        <SettingsFormField
          id="template-schema"
          label={tr("template.form.requestSchema", dict)}
          error={trDynamic(errors.requestSchemaText?.message ?? "", dict)}
        >
          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("template.form.requestSchemaHelp", dict)}
          </p>
          <Textarea
            id="template-schema"
            rows={10}
            className="font-mono text-xs"
            placeholder={SCHEMA_PLACEHOLDER}
            {...register("requestSchemaText")}
            color={errors.requestSchemaText ? "failure" : "gray"}
          />
        </SettingsFormField>

        {leaves.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {tr("template.form.fieldsDetected", dict)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {leaves.map((leaf) => (
                <code
                  key={leaf}
                  className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {leaf}
                </code>
              ))}
            </div>
          </div>
        )}
      </>
    </IntegrationFormModal>
  );
}
