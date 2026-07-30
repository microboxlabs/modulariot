"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Select, Spinner, TextInput } from "flowbite-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  HiCheckCircle,
  HiLockClosed,
  HiTrash,
  HiXCircle,
} from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  BUILT_IN_ENVIRONMENTS,
  findCredentialType,
  OAuth2CredentialEditSchema,
  OAuth2CredentialSchema,
  type CredentialListItem,
  type CredentialTestResult,
  type OAuth2Config,
  type OAuth2FormData,
} from "../credential.types";
import { CredentialTypeLogo } from "./credential-type-logo";
import { EnvironmentSelect } from "./environment-select";

const OAUTH2_TYPE = findCredentialType("OAUTH2_CLIENT_CREDENTIALS");

interface OAuth2CredentialModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: OAuth2FormData) => void;
  readonly onTest: (data: OAuth2FormData) => Promise<CredentialTestResult>;
  /** Delete this credential — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  readonly editing?: CredentialListItem | null;
  readonly loading?: boolean;
  /** Selectable environments; users can still create one that isn't listed. */
  readonly environments?: readonly string[];
  readonly dict: I18nRecord;
}

const DEFAULTS: OAuth2FormData = {
  name: "",
  environment: "DEVELOPMENT",
  tokenUrl: "",
  clientId: "",
  clientSecret: "",
  audience: "",
  scope: "",
  tokenRequestFormat: "FORM",
};

/**
 * Create/edit form for a generic OAuth2 client-credentials credential — any
 * provider that issues a token from a client id/secret pair.
 *
 * The token endpoint is typed rather than derived, because outside Entra there
 * is no directory id to build it from. `audience` is surfaced as a first-class
 * field even though RFC 6749 has no such parameter: Auth0's machine-to-machine
 * grant returns an opaque token unless the API identifier is sent, so a form
 * without it cannot configure the case this type is most often used for.
 */
export function OAuth2CredentialModal({
  show,
  onClose,
  onSubmit,
  onTest,
  onDelete,
  editing = null,
  loading = false,
  environments = BUILT_IN_ENVIRONMENTS,
  dict,
}: OAuth2CredentialModalProps) {
  const isEdit = editing !== null;
  const [testResult, setTestResult] = useState<CredentialTestResult | null>(
    null
  );
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<OAuth2FormData>({
    resolver: zodResolver(
      isEdit ? OAuth2CredentialEditSchema : OAuth2CredentialSchema
    ),
    defaultValues: DEFAULTS,
  });

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    if (!show) return;
    setTestResult(null);
    if (!editing) {
      reset(DEFAULTS);
      return;
    }
    const config = editing.config as OAuth2Config;
    reset({
      name: editing.name,
      environment: editing.environment,
      tokenUrl: config.tokenUrl ?? "",
      clientId: config.clientId ?? "",
      clientSecret: "",
      audience: config.audience ?? "",
      scope: config.scope ?? "",
      tokenRequestFormat: config.tokenRequestFormat ?? "FORM",
    });
  }, [show, editing, reset]);

  async function handleTest(data: OAuth2FormData) {
    setTesting(true);
    try {
      setTestResult(await onTest(data));
    } finally {
      setTesting(false);
    }
  }

  let submitLabel: string;
  if (loading) {
    submitLabel = tr("modal.saving", dict);
  } else if (isEdit) {
    submitLabel = tr("modal.saveButton", dict);
  } else {
    submitLabel = tr("modal.createButton", dict);
  }

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="3xl"
      title={isEdit ? tr("modal.editTitle", dict) : tr("modal.addTitle", dict)}
      subtitle={tr("modal.oauth2Subtitle", dict)}
      icon={
        <CredentialTypeLogo
          logo={OAUTH2_TYPE?.logo}
          alt={trDynamic("types.oauth2.name", dict)}
          size={40}
        />
      }
      headerActions={
        isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={tr("modal.delete", dict)}
            title={tr("modal.delete", dict)}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <HiTrash className="h-4 w-4" />
          </button>
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
            id="oauth2-name"
            label={tr("modal.name", dict)}
            error={trDynamic(errors.name?.message ?? "", dict)}
          >
            <TextInput
              id="oauth2-name"
              placeholder={tr("modal.namePlaceholder", dict)}
              {...register("name")}
              color={errors.name ? "failure" : undefined}
            />
          </SettingsFormField>

          <SettingsFormField
            id="oauth2-environment"
            label={tr("modal.environment", dict)}
            error={trDynamic(errors.environment?.message ?? "", dict)}
          >
            <Controller
              control={control}
              name="environment"
              render={({ field }) => (
                <EnvironmentSelect
                  id="oauth2-environment"
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
          id="oauth2-token-url"
          label={tr("modal.tokenUrl", dict)}
          error={trDynamic(errors.tokenUrl?.message ?? "", dict)}
        >
          <TextInput
            id="oauth2-token-url"
            type="url"
            placeholder={tr("modal.tokenUrlPlaceholder", dict)}
            {...register("tokenUrl")}
            color={errors.tokenUrl ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.tokenUrlHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="oauth2-client"
          label={tr("modal.clientId", dict)}
          error={trDynamic(errors.clientId?.message ?? "", dict)}
        >
          <TextInput
            id="oauth2-client"
            placeholder={tr("modal.clientIdPlaceholder", dict)}
            {...register("clientId")}
            color={errors.clientId ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="oauth2-secret"
          label={tr("modal.clientSecret", dict)}
          error={trDynamic(errors.clientSecret?.message ?? "", dict)}
        >
          <TextInput
            id="oauth2-secret"
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
          id="oauth2-audience"
          label={tr("modal.audience", dict)}
          error={trDynamic(errors.audience?.message ?? "", dict)}
        >
          <TextInput
            id="oauth2-audience"
            placeholder={tr("modal.audiencePlaceholder", dict)}
            {...register("audience")}
            color={errors.audience ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.audienceHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="oauth2-scope"
          label={tr("modal.scopeOptional", dict)}
          error={trDynamic(errors.scope?.message ?? "", dict)}
        >
          <TextInput
            id="oauth2-scope"
            placeholder={tr("modal.scopePlaceholder", dict)}
            {...register("scope")}
            color={errors.scope ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.scopeOptionalHelp", dict)}
          </p>
        </SettingsFormField>

        <details className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("modal.advanced", dict)}
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            <SettingsFormField
              id="oauth2-token-format"
              label={tr("modal.tokenRequestFormat", dict)}
            >
              <Select id="oauth2-token-format" {...register("tokenRequestFormat")}>
                <option value="FORM">
                  {tr("modal.tokenFormatForm", dict)}
                </option>
                <option value="JSON">
                  {tr("modal.tokenFormatJson", dict)}
                </option>
              </Select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.tokenRequestFormatHelp", dict)}
              </p>
            </SettingsFormField>
          </div>
        </details>

        {/* Testing lives here rather than on the list row: only some credential
            types can be verified on their own, so the action belongs with the
            record that knows whether it means anything. */}
        {OAUTH2_TYPE?.supportsTest && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              color="light"
              disabled={testing || loading}
              onClick={handleSubmit(handleTest)}
            >
              {testing ? <Spinner size="sm" /> : tr("modal.testConnection", dict)}
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

interface TestResultLineProps {
  readonly result: CredentialTestResult;
  readonly dict: I18nRecord;
}

function TestResultLine({ result, dict }: TestResultLineProps) {
  if (result.success) {
    return (
      <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
        <HiCheckCircle className="h-4 w-4" />
        {tr("modal.testSuccess", dict)}
        {result.expiresInSeconds ? ` · ${result.expiresInSeconds}s` : ""}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
      <HiXCircle className="h-4 w-4" />
      {tr("modal.testFailed", dict)}
      {result.message ? ` · ${result.message}` : ""}
    </span>
  );
}

interface UsedByPanelProps {
  readonly credential: CredentialListItem;
  readonly dict: I18nRecord;
}

/** Edit-time blast radius: what breaks if this credential changes. */
function UsedByPanel({ credential, dict }: UsedByPanelProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {tr("modal.usedBy", dict)}
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {credential.usedBy.map((usage) => (
          <li
            key={usage.id}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {trDynamic(`usageKinds.${usage.kind}`, dict)}
            </span>
            {usage.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
