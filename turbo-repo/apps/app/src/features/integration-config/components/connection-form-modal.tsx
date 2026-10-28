"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Select, Spinner, TextInput } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  HiCheckCircle,
  HiLockClosed,
  HiOutlineLink,
  HiXCircle,
} from "react-icons/hi";
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
  type NativeProvider,
  type UpdateConnectionRequest,
} from "../integration-config.types";
import { IntegrationFormModal } from "./integration-form-modal";
import type { BrandLogoSources } from "@/features/common/components/brand-logo";
import { BIGQUERY_LOGO, POSTGREST_LOGO } from "../connection-catalog";
import { BIGQUERY_BASE_URL, isBigQueryConnection } from "../bigquery-query";

interface ConnectionFormModalProps {
  readonly show: boolean;
  /** The instance being edited, or undefined to create a new one. */
  readonly connection: IntegrationConnection | undefined;
  /** The contract this instance speaks: from the picker when creating, resolved when editing. */
  readonly template: IntegrationTemplate | undefined;
  /** A built-in provider being created without a template. */
  readonly providerType?: NativeProvider;
  readonly credentials: readonly CredentialListItem[];
  readonly onClose: () => void;
  readonly onSave: (
    create: CreateConnectionRequest | null,
    id?: string,
    patch?: UpdateConnectionRequest
  ) => Promise<unknown>;
  /** Delete this connection — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  /** Test a saved connection by id; the result is stored on it. */
  readonly onTest?: (id: string) => Promise<ConnectionTestResult>;
  /** Test the form values before the connection exists; nothing is stored. */
  readonly onTestDraft?: (
    request: CreateConnectionRequest
  ) => Promise<ConnectionTestResult>;
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
  providerType,
  credentials,
  onClose,
  onSave,
  onDelete,
  onTest,
  onTestDraft,
  saving,
  dict,
}: Readonly<ConnectionFormModalProps>) {
  const isEdit = connection !== undefined;
  const isPostgrest =
    !template && (providerType ?? connection?.providerType) === "POSTGREST";
  const isBigQuery =
    !template &&
    (providerType === "BIGQUERY" ||
      (connection !== undefined && isBigQueryConnection(connection)));
  // BigQuery queries authenticate with a Google service account and nothing else.
  let nativeKind: NativeKind | null = null;
  if (isBigQuery) nativeKind = "BIGQUERY";
  else if (isPostgrest) nativeKind = "POSTGREST";
  const choices = isBigQuery
    ? credentials.filter((c) => c.typeId === "GOOGLE_SERVICE_ACCOUNT")
    : credentials;
  const [error, setError] = useState<Error | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null
  );
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const session = useRef(0);
  const working = useRef(false);
  const busy = saving || testing || submitting;
  /** The request of the last draft test that passed, to repeat it once the connection exists. */
  const passedDraft = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(ConnectionFormSchema),
    defaultValues: DEFAULTS,
  });

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    session.current += 1;
    working.current = false;
    setTesting(false);
    setSubmitting(false);
    if (!show) return;
    setError(null);
    setTestResult(null);
    passedDraft.current = null;
    reset(
      connection
        ? {
            name: connection.name,
            baseUrl: connection.baseUrl,
            credentialProfileId: connection.credentialProfileId ?? "",
          }
        : { ...DEFAULTS, baseUrl: isBigQuery ? BIGQUERY_BASE_URL : "" }
    );
    return () => {
      session.current += 1;
    };
  }, [show, connection, template, providerType, reset, isBigQuery]);

  /** What creating with these values sends; null when editing. */
  function createRequest(
    data: ConnectionFormData
  ): CreateConnectionRequest | null {
    const common = {
      name: data.name.trim(),
      baseUrl: data.baseUrl.trim(),
      credentialProfileId: data.credentialProfileId || null,
    };
    if (connection) return null;
    if (template) return { ...common, templateId: template.id };
    if (providerType) {
      return {
        ...common,
        providerType:
          providerType === "BIGQUERY" ? "CUSTOM_HTTP" : providerType,
      };
    }
    return null;
  }

  function missingCredential(data: ConnectionFormData): boolean {
    if (
      !isBigQuery ||
      choices.some((credential) => credential.id === data.credentialProfileId)
    )
      return false;
    setError(new Error(tr("bigquery.credentialRequired", dict)));
    return true;
  }

  async function submit(data: ConnectionFormData) {
    if (saving || working.current) return;
    setError(null);
    if (missingCredential(data)) return;
    working.current = true;
    setSubmitting(true);
    const current = session.current;
    const request = createRequest(data);
    const repeatTest =
      !isPostgrest &&
      request !== null &&
      passedDraft.current === JSON.stringify(request);
    try {
      if (connection) {
        await onSave(null, connection.id, {
          name: data.name.trim(),
          baseUrl: data.baseUrl.trim(),
          credentialProfileId: data.credentialProfileId || null,
        });
        if (current === session.current) onClose();
      } else if (request) {
        const created = (await onSave(request)) as
          | IntegrationConnection
          | undefined;
        if (current === session.current) onClose();
        // Record the saved connection's result after closing the original form.
        if (onTest && created?.id && repeatTest) {
          await onTest(created.id).catch(() => undefined);
        }
      }
    } catch (cause) {
      if (current === session.current) {
        setError(
          cause instanceof Error
            ? cause
            : new Error(tr("common.saveFailed", dict))
        );
      }
    } finally {
      if (current === session.current) {
        working.current = false;
        setSubmitting(false);
      }
    }
  }

  const canTest = connection ? onTest !== undefined : onTestDraft !== undefined;

  async function handleTest() {
    if (saving || working.current) return;
    working.current = true;
    const current = session.current;
    setError(null);
    setTestResult(null);
    setTesting(true);
    try {
      let result: ConnectionTestResult | null = null;
      let request: CreateConnectionRequest | null = null;
      if (connection && onTest) result = await onTest(connection.id);
      else if (onTestDraft && (await trigger())) {
        if (current !== session.current) return;
        const data = getValues();
        if (missingCredential(data)) return;
        request = createRequest(data);
        if (request) result = await onTestDraft(request);
      }
      if (current !== session.current) return;
      passedDraft.current =
        result?.success && request ? JSON.stringify(request) : null;
      setTestResult(result);
    } catch (cause) {
      if (current === session.current) {
        passedDraft.current = null;
        setTestResult({
          success: false,
          testedAt: new Date().toISOString(),
          message: cause instanceof Error ? cause.message : null,
        });
      }
    } finally {
      if (current === session.current) {
        working.current = false;
        setTesting(false);
      }
    }
  }

  function close() {
    if (!busy) onClose();
  }

  return (
    <IntegrationFormModal
      show={show}
      isEdit={isEdit}
      title={
        isEdit
          ? tr("connection.form.editTitle", dict)
          : tr("connection.form.createTitle", dict)
      }
      subtitle={formSubtitle(nativeKind, dict)}
      glyph={<HiOutlineLink className="h-5 w-5" />}
      logo={nativeKind ? NATIVE_LOGOS[nativeKind] : undefined}
      onClose={close}
      onDelete={onDelete}
      onSubmit={handleSubmit(submit)}
      error={error}
      saving={saving || submitting}
      busy={busy}
      dict={dict}
    >
      <fieldset disabled={busy} className="flex flex-col gap-4">
        <legend className="sr-only">
          {tr("connection.form.createTitle", dict)}
        </legend>
        {template && <ContractPanel template={template} dict={dict} />}

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
            readOnly={isBigQuery}
            {...register("baseUrl")}
            color={errors.baseUrl ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {baseUrlHelp(isPostgrest, isBigQuery, dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="connection-credential"
          label={tr("connection.form.credential", dict)}
        >
          <Select
            id="connection-credential"
            {...register("credentialProfileId")}
          >
            <option value="">{tr("connection.form.noCredential", dict)}</option>
            {choices.map((credential) => (
              <option key={credential.id} value={credential.id}>
                {credential.name} · {credential.environment}
              </option>
            ))}
          </Select>
          {choices.length === 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {isBigQuery
                ? tr("bigquery.noCredentials", dict)
                : tr("connection.form.noCredentials", dict)}
            </p>
          )}
        </SettingsFormField>

        {/* Creating tests the form values without storing anything; editing tests the
          saved connection and records the result on it. */}
        {canTest && (
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
      </fieldset>
    </IntegrationFormModal>
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

type NativeKind = "POSTGREST" | "BIGQUERY";

const NATIVE_LOGOS: Record<NativeKind, BrandLogoSources> = {
  POSTGREST: POSTGREST_LOGO,
  BIGQUERY: BIGQUERY_LOGO,
};

/** A built-in provider explains itself in the subtitle; a template's contract is shown below it. */
function formSubtitle(kind: NativeKind | null, dict: I18nRecord): string {
  if (kind === "BIGQUERY") return tr("bigquery.help", dict);
  if (kind === "POSTGREST") return tr("connection.form.postgrestHelp", dict);
  return tr("connection.form.subtitle", dict);
}

function baseUrlHelp(
  isPostgrest: boolean,
  isBigQuery: boolean,
  dict: I18nRecord
): string {
  if (isBigQuery) return tr("bigquery.baseUrlHelp", dict);
  if (isPostgrest) return tr("connection.form.postgrestBaseUrlHelp", dict);
  return tr("connection.form.baseUrlHelp", dict);
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
        {result.message ? ` · ${result.message}` : ""}
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
