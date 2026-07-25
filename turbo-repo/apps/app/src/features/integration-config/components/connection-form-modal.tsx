"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Select, Spinner, TextInput } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  HiCheckCircle,
  HiLockClosed,
  HiOutlineLink,
  HiTrash,
  HiXCircle,
} from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import {
  ConnectionFormSchema,
  schemaLeafPaths,
  type ConnectionFormData,
  type ConnectionTestResult,
  type CreateConnectionRequest,
  type IntegrationConnection,
  type IntegrationTemplate,
  type UpdateConnectionRequest,
} from "../integration-config.types";
import { ModalGlyph } from "./modal-glyph";

interface ConnectionFormModalProps {
  readonly show: boolean;
  /** The instance being edited, or undefined to create a new one. */
  readonly connection: IntegrationConnection | undefined;
  /** The contract this instance speaks: from the picker when creating, resolved when editing. */
  readonly template: IntegrationTemplate | undefined;
  readonly credentials: readonly CredentialListItem[];
  readonly onClose: () => void;
  readonly onSave: (
    create: CreateConnectionRequest | null,
    id?: string,
    patch?: UpdateConnectionRequest
  ) => Promise<unknown>;
  /** Delete this connection — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  /** Exercise the saved connection; absent while creating, since there is no id yet. */
  readonly onTest?: () => Promise<ConnectionTestResult>;
  readonly saving: boolean;
  readonly dict: I18nRecord;
}

const DEFAULTS: ConnectionFormData = {
  name: "",
  baseUrl: "",
  credentialProfileId: "",
};

/**
 * Create/edit form for a connection — one instance of a template.
 *
 * Only what varies per instance is editable: the endpoint and the credential. The
 * contract comes from the template and is shown read-only, because changing it would
 * change the payload under the bindings already mapped against it.
 */
export function ConnectionFormModal({
  show,
  connection,
  template,
  credentials,
  onClose,
  onSave,
  onDelete,
  onTest,
  saving,
  dict,
}: Readonly<ConnectionFormModalProps>) {
  const isEdit = connection !== undefined;
  const [error, setError] = useState<Error | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null
  );
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(ConnectionFormSchema),
    defaultValues: DEFAULTS,
  });

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    if (!show) return;
    setError(null);
    setTestResult(null);
    reset(
      connection
        ? {
            name: connection.name,
            baseUrl: connection.baseUrl,
            credentialProfileId: connection.credentialProfileId ?? "",
          }
        : DEFAULTS
    );
  }, [show, connection, reset]);

  async function submit(data: ConnectionFormData) {
    const credentialProfileId = data.credentialProfileId || null;
    setError(null);
    try {
      if (connection) {
        await onSave(null, connection.id, {
          name: data.name.trim(),
          baseUrl: data.baseUrl.trim(),
          credentialProfileId,
        });
      } else if (template) {
        await onSave({
          name: data.name.trim(),
          baseUrl: data.baseUrl.trim(),
          credentialProfileId,
          templateId: template.id,
        });
      }
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error(tr("common.saveFailed", dict))
      );
    }
  }

  async function handleTest() {
    if (!onTest) return;
    setTesting(true);
    try {
      setTestResult(await onTest());
    } finally {
      setTesting(false);
    }
  }

  let submitLabel: string;
  if (saving) {
    submitLabel = tr("common.saving", dict);
  } else if (isEdit) {
    submitLabel = tr("common.save", dict);
  } else {
    submitLabel = tr("common.create", dict);
  }

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="3xl"
      title={
        isEdit
          ? tr("connection.form.editTitle", dict)
          : tr("connection.form.createTitle", dict)
      }
      subtitle={tr("connection.form.subtitle", dict)}
      icon={
        <ModalGlyph>
          <HiOutlineLink className="h-5 w-5" />
        </ModalGlyph>
      }
      headerActions={
        isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={tr("common.delete", dict)}
            title={tr("common.delete", dict)}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <HiTrash className="h-4 w-4" />
          </button>
        ) : null
      }
      submitLabel={submitLabel}
      isProcessing={saving}
      error={error}
      onSubmit={handleSubmit(submit)}
      showCancelButton
      cancelLabel={tr("common.cancel", dict)}
    >
      <div className="flex flex-col gap-4">
        <ContractPanel template={template} dict={dict} />

        <SettingsFormField
          id="connection-name"
          label={tr("connection.form.name", dict)}
          error={trDynamic(errors.name?.message ?? "", dict)}
        >
          <TextInput
            id="connection-name"
            placeholder={tr("connection.form.namePlaceholder", dict)}
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="connection-base-url"
          label={tr("connection.form.baseUrl", dict)}
          error={trDynamic(errors.baseUrl?.message ?? "", dict)}
        >
          <TextInput
            id="connection-base-url"
            type="url"
            className="font-mono [&_input]:text-sm"
            placeholder="https://api.partner.example.com"
            {...register("baseUrl")}
            color={errors.baseUrl ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("connection.form.baseUrlHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="connection-credential"
          label={tr("connection.form.credential", dict)}
        >
          <Select id="connection-credential" {...register("credentialProfileId")}>
            <option value="">{tr("connection.form.noCredential", dict)}</option>
            {credentials.map((credential) => (
              <option key={credential.id} value={credential.id}>
                {credential.name} · {credential.environment}
              </option>
            ))}
          </Select>
          {credentials.length === 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {tr("connection.form.noCredentials", dict)}
            </p>
          )}
        </SettingsFormField>

        {/* Testing an instance calls the real endpoint, so it only exists once the
            instance does — while creating there is nothing yet to exercise. */}
        {isEdit && onTest && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              color="light"
              disabled={testing || saving}
              onClick={handleTest}
            >
              {testing ? <Spinner size="sm" /> : tr("connections.test", dict)}
            </Button>
            {testResult && <TestResultLine result={testResult} dict={dict} />}
          </div>
        )}

        <Alert color="gray" icon={HiLockClosed}>
          <span className="text-xs">
            {tr("connection.form.secretNotice", dict)}
          </span>
        </Alert>
      </div>
    </FormModal>
  );
}

/**
 * Read-only echo of the contract this instance inherits — the counterpart of the
 * credential form's token-endpoint preview: what will actually be called, shown
 * where it can't be edited into disagreeing with the template.
 */
function ContractPanel({
  template,
  dict,
}: Readonly<{ template: IntegrationTemplate | undefined; dict: I18nRecord }>) {
  if (!template) return null;
  const fields = schemaLeafPaths(template.requestSchema);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {tr("connection.form.template", dict)}
      </div>
      <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
        {template.name}
      </div>
      <code className="mt-1 block break-all font-mono text-xs text-gray-600 dark:text-gray-400">
        {template.method} {template.path}
      </code>
      {fields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {fields.map((field) => (
            <code
              key={field}
              className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {field}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

function TestResultLine({
  result,
  dict,
}: Readonly<{ result: ConnectionTestResult; dict: I18nRecord }>) {
  if (result.success) {
    return (
      <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
        <HiCheckCircle className="h-4 w-4" />
        {tr("toast.testOk", dict)}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
      <HiXCircle className="h-4 w-4" />
      {tr("toast.testFailed", dict)}
      {result.message ? ` · ${result.message}` : ""}
    </span>
  );
}
