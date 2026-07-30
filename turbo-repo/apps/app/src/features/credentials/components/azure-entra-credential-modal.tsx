"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Select, Spinner, TextInput } from "flowbite-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HiLockClosed } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  AzureEntraCredentialEditSchema,
  AzureEntraCredentialSchema,
  BUILT_IN_ENVIRONMENTS,
  buildEntraTokenUrl,
  findCredentialType,
  type AzureEntraConfig,
  type AzureEntraFormData,
  type CredentialListItem,
  type CredentialTestResult,
} from "../credential.types";
import { CredentialTypeLogo } from "./credential-type-logo";
import { EnvironmentSelect } from "./environment-select";
import {
  credentialSubmitLabel,
  DeleteHeaderAction,
  TestResultLine,
  UsedByPanel,
} from "./credential-modal-parts";

const ENTRA_TYPE = findCredentialType("AZURE_ENTRA_CLIENT_CREDENTIALS");

interface AzureEntraCredentialModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: AzureEntraFormData) => void;
  readonly onTest: (data: AzureEntraFormData) => Promise<CredentialTestResult>;
  /** Delete this credential — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  readonly editing?: CredentialListItem | null;
  readonly loading?: boolean;
  /** Selectable environments; users can still create one that isn't listed. */
  readonly environments?: readonly string[];
  readonly dict: I18nRecord;
}

const DEFAULTS: AzureEntraFormData = {
  name: "",
  environment: "DEVELOPMENT",
  tenantId: "",
  clientId: "",
  clientSecret: "",
  scope: "",
  tokenRequestFormat: "FORM",
  tokenUrlOverride: "",
};

/**
 * Create/edit form for an Azure Entra (Microsoft Identity Platform)
 * client-credentials credential — the first credential type.
 *
 * The token endpoint is derived from the directory (tenant) id rather than
 * typed, so the URL can't drift from the tenant it belongs to; the override is
 * there for sovereign clouds and B2C policies.
 */
export function AzureEntraCredentialModal({
  show,
  onClose,
  onSubmit,
  onTest,
  onDelete,
  editing = null,
  loading = false,
  environments = BUILT_IN_ENVIRONMENTS,
  dict,
}: AzureEntraCredentialModalProps) {
  const isEdit = editing !== null;
  const [testResult, setTestResult] = useState<CredentialTestResult | null>(
    null
  );
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<AzureEntraFormData>({
    resolver: zodResolver(
      isEdit ? AzureEntraCredentialEditSchema : AzureEntraCredentialSchema
    ),
    defaultValues: DEFAULTS,
  });

  const tenantId = watch("tenantId");
  const tokenUrlOverride = watch("tokenUrlOverride");

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    if (!show) return;
    setTestResult(null);
    if (!editing) {
      reset(DEFAULTS);
      return;
    }
    const config = editing.config as AzureEntraConfig;
    reset({
      name: editing.name,
      environment: editing.environment,
      tenantId: config.tenantId ?? "",
      clientId: config.clientId ?? "",
      clientSecret: "",
      scope: config.scope ?? "",
      tokenRequestFormat: config.tokenRequestFormat ?? "FORM",
      tokenUrlOverride: config.tokenUrlOverride ?? "",
    });
  }, [show, editing, reset]);

  async function handleTest(data: AzureEntraFormData) {
    setTesting(true);
    try {
      setTestResult(await onTest(data));
    } finally {
      setTesting(false);
    }
  }

  const submitLabel = credentialSubmitLabel(loading, isEdit, dict);

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="3xl"
      title={isEdit ? tr("modal.editTitle", dict) : tr("modal.addTitle", dict)}
      subtitle={tr("modal.subtitle", dict)}
      icon={
        <CredentialTypeLogo
          logo={ENTRA_TYPE?.logo}
          alt={trDynamic("types.azureEntra.name", dict)}
          size={40}
        />
      }
      headerActions={
        isEdit && onDelete ? (
          <DeleteHeaderAction onDelete={onDelete} dict={dict} />
        ) : null
      }
      submitLabel={submitLabel}
      isProcessing={loading}
      onSubmit={handleSubmit(onSubmit)}
      showCancelButton
      cancelLabel={tr("modal.cancel", dict)}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
          <SettingsFormField
            id="cred-name"
            label={tr("modal.name", dict)}
            error={trDynamic(errors.name?.message ?? "", dict)}
          >
            <TextInput
              id="cred-name"
              placeholder={tr("modal.namePlaceholder", dict)}
              {...register("name")}
              color={errors.name ? "failure" : undefined}
            />
          </SettingsFormField>

          <SettingsFormField
            id="cred-environment"
            label={tr("modal.environment", dict)}
            error={trDynamic(errors.environment?.message ?? "", dict)}
          >
            <Controller
              control={control}
              name="environment"
              render={({ field }) => (
                <EnvironmentSelect
                  id="cred-environment"
                  value={field.value}
                  onChange={field.onChange}
                  options={environments}
                  invalid={Boolean(errors.environment)}
                  dict={dict}
                />
              )}
            />
          </SettingsFormField>
        </div>

        <SettingsFormField
          id="cred-tenant"
          label={tr("modal.tenantId", dict)}
          error={trDynamic(errors.tenantId?.message ?? "", dict)}
        >
          <TextInput
            id="cred-tenant"
            placeholder={tr("modal.guidPlaceholder", dict)}
            {...register("tenantId")}
            color={errors.tenantId ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.tenantIdHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="cred-client"
          label={tr("modal.clientId", dict)}
          error={trDynamic(errors.clientId?.message ?? "", dict)}
        >
          <TextInput
            id="cred-client"
            placeholder={tr("modal.guidPlaceholder", dict)}
            {...register("clientId")}
            color={errors.clientId ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="cred-secret"
          label={tr("modal.clientSecret", dict)}
          error={trDynamic(errors.clientSecret?.message ?? "", dict)}
        >
          <TextInput
            id="cred-secret"
            type="password"
            autoComplete="new-password"
            placeholder={
              isEdit
                ? tr("modal.clientSecretEditPlaceholder", dict)
                : tr("modal.clientSecretPlaceholder", dict)
            }
            {...register("clientSecret")}
            color={errors.clientSecret ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="cred-scope"
          label={tr("modal.scope", dict)}
          error={trDynamic(errors.scope?.message ?? "", dict)}
        >
          <TextInput
            id="cred-scope"
            placeholder={tr("modal.scopePlaceholder", dict)}
            {...register("scope")}
            color={errors.scope ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.scopeHelp", dict)}
          </p>
        </SettingsFormField>

        <TokenEndpointPreview
          tenantId={tenantId}
          override={tokenUrlOverride}
          dict={dict}
        />

        <details className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("modal.advanced", dict)}
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            <SettingsFormField
              id="cred-token-format"
              label={tr("modal.tokenRequestFormat", dict)}
            >
              <Select
                id="cred-token-format"
                {...register("tokenRequestFormat")}
              >
                <option value="FORM">
                  {tr("modal.tokenFormatForm", dict)}
                </option>
                <option value="JSON">
                  {tr("modal.tokenFormatJson", dict)}
                </option>
              </Select>
            </SettingsFormField>

            <SettingsFormField
              id="cred-token-url"
              label={tr("modal.tokenUrlOverride", dict)}
              error={trDynamic(errors.tokenUrlOverride?.message ?? "", dict)}
            >
              <TextInput
                id="cred-token-url"
                type="url"
                placeholder={tr("modal.tokenUrlOverridePlaceholder", dict)}
                {...register("tokenUrlOverride")}
                color={errors.tokenUrlOverride ? "failure" : undefined}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.tokenUrlOverrideHelp", dict)}
              </p>
            </SettingsFormField>
          </div>
        </details>

        {/* Testing lives here rather than on the list row: only some credential
            types can be verified on their own, so the action belongs with the
            record that knows whether it means anything. */}
        {ENTRA_TYPE?.supportsTest && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              color="light"
              disabled={testing || loading}
              onClick={handleSubmit(handleTest)}
            >
              {testing ? (
                <Spinner size="sm" />
              ) : (
                tr("modal.testConnection", dict)
              )}
            </Button>
            {testResult && <TestResultLine result={testResult} dict={dict} />}
          </div>
        )}

        {isEdit && editing.usedBy.length > 0 && (
          <UsedByPanel credential={editing} dict={dict} />
        )}

        <Alert color="gray" icon={HiLockClosed}>
          <span className="text-xs">{tr("modal.secretNotice", dict)}</span>
        </Alert>
      </div>
    </FormModal>
  );
}

interface TokenEndpointPreviewProps {
  readonly tenantId: string;
  readonly override?: string;
  readonly dict: I18nRecord;
}

/** Read-only echo of the endpoint the credential will actually call. */
function TokenEndpointPreview({
  tenantId,
  override,
  dict,
}: TokenEndpointPreviewProps) {
  const url = override?.trim() ? override.trim() : buildEntraTokenUrl(tenantId);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {tr("modal.tokenEndpoint", dict)}
      </div>
      <code className="mt-1 block break-all font-mono text-xs text-gray-600 dark:text-gray-400">
        {url}
      </code>
    </div>
  );
}
