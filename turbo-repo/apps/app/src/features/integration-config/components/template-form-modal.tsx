"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Select,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiInformationCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  HTTP_METHODS,
  PROVIDER_TYPES,
  parseJsonObject,
  schemaLeafPaths,
  type CreateTemplateRequest,
  type IntegrationTemplate,
} from "../integration-config.types";

interface TemplateFormModalProps {
  readonly show: boolean;
  readonly template: IntegrationTemplate | undefined;
  readonly onClose: () => void;
  readonly onSave: (body: CreateTemplateRequest, id?: string) => Promise<unknown>;
  readonly saving: boolean;
  readonly dict: I18nRecord;
}

const SCHEMA_PLACEHOLDER = `{
  "type": "object",
  "properties": {
    "serviceCode": { "type": "string" },
    "aprobada": { "type": "boolean" }
  },
  "required": ["serviceCode"]
}`;

export function TemplateFormModal({
  show,
  template,
  onClose,
  onSave,
  saving,
  dict,
}: Readonly<TemplateFormModalProps>) {
  const editing = template !== undefined;
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState(PROVIDER_TYPES[0]);
  const [operationName, setOperationName] = useState("");
  const [method, setMethod] = useState(HTTP_METHODS[0]);
  const [path, setPath] = useState("");
  const [requestSchemaText, setRequestSchemaText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    setError(null);
    setName(template?.name ?? "");
    setProviderType(template?.providerType ?? PROVIDER_TYPES[0]);
    setOperationName(template?.operationName ?? "");
    setMethod(template?.method ?? HTTP_METHODS[0]);
    setPath(template?.path ?? "");
    setRequestSchemaText(
      template?.requestSchema && Object.keys(template.requestSchema).length > 0
        ? JSON.stringify(template.requestSchema, null, 2)
        : ""
    );
  }, [show, template]);

  const schemaCheck = useMemo(() => parseJsonObject(requestSchemaText), [requestSchemaText]);
  const leaves = useMemo(
    () => ("value" in schemaCheck ? schemaLeafPaths(schemaCheck.value) : []),
    [schemaCheck]
  );
  const schemaBroken = "error" in schemaCheck;

  const canSave =
    name.trim() !== "" && path.trim() !== "" && !schemaBroken && !saving;

  async function handleSave() {
    if ("error" in schemaCheck) {
      setError(tr("template.form.schemaInvalid", dict));
      return;
    }
    try {
      await onSave(
        {
          name: name.trim(),
          providerType,
          operationName: operationName.trim(),
          method,
          path: path.trim(),
          requestSchema: schemaCheck.value,
          responseSchema: {},
        },
        template?.id
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("common.saveFailed", dict));
    }
  }

  return (
    <Modal show={show} onClose={onClose} size="2xl">
      <ModalHeader>
        {editing ? tr("template.form.editTitle", dict) : tr("template.form.createTitle", dict)}
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {error && (
            <Alert color="failure" icon={HiInformationCircle}>
              <span className="text-xs">{error}</span>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={tr("template.form.name", dict)}>
              <TextInput
                sizing="sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr("template.form.namePlaceholder", dict)}
              />
            </Field>
            <Field label={tr("template.form.providerType", dict)}>
              <Select
                sizing="sm"
                value={providerType}
                disabled={editing}
                onChange={(e) => setProviderType(e.target.value)}
              >
                {PROVIDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
            <Field label={tr("template.form.method", dict)}>
              <Select sizing="sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                {HTTP_METHODS.map((verb) => (
                  <option key={verb} value={verb}>
                    {verb}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr("template.form.path", dict)}>
              <TextInput
                sizing="sm"
                className="font-mono [&_input]:text-xs"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/api/v1/resource"
              />
            </Field>
          </div>

          <Field label={tr("template.form.operationName", dict)}>
            <TextInput
              sizing="sm"
              value={operationName}
              onChange={(e) => setOperationName(e.target.value)}
              placeholder={tr("template.form.operationNamePlaceholder", dict)}
            />
          </Field>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">{tr("template.form.requestSchema", dict)}</Label>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {tr("template.form.requestSchemaHelp", dict)}
            </p>
            <Textarea
              rows={9}
              className="font-mono text-xs"
              value={requestSchemaText}
              onChange={(e) => setRequestSchemaText(e.target.value)}
              placeholder={SCHEMA_PLACEHOLDER}
              color={schemaBroken ? "failure" : "gray"}
            />
            <SchemaFeedback
              schemaBroken={schemaBroken}
              leaves={leaves}
              dict={dict}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button color="gray" size="sm" onClick={onClose}>
              {tr("common.cancel", dict)}
            </Button>
            <Button color="blue" size="sm" onClick={handleSave} disabled={!canSave}>
              {saving ? tr("common.saving", dict) : tr("common.save", dict)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

function SchemaFeedback({
  schemaBroken,
  leaves,
  dict,
}: Readonly<{
  schemaBroken: boolean;
  leaves: readonly string[];
  dict: I18nRecord;
}>) {
  if (schemaBroken) {
    return (
      <p className="text-[11px] text-red-600 dark:text-red-400">
        {tr("template.form.schemaInvalid", dict)}
      </p>
    );
  }
  if (leaves.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-[11px] text-gray-500 dark:text-gray-400">
        {tr("template.form.fieldsDetected", dict)}:
      </span>
      {leaves.map((leaf) => (
        <code
          key={leaf}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        >
          {leaf}
        </code>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
