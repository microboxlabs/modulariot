"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Select, Spinner, TextInput } from "flowbite-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HiLockClosed } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  Auth0M2MCredentialEditSchema,
  Auth0M2MCredentialSchema,
  BUILT_IN_ENVIRONMENTS,
  buildAuth0TokenUrl,
  findCredentialType,
  type Auth0M2MConfig,
  type Auth0M2MFormData,
  type CredentialListItem,
  type CredentialTestResult,
} from "../credential.types";
import { CredentialTypeLogo } from "./credential-type-logo";
import { EnvironmentSelect } from "./environment-select";
import { M2MClientCombobox } from "./m2m-client-combobox";
import {
  credentialSubmitLabel,
  DeleteHeaderAction,
  TestResultLine,
  UsedByPanel,
} from "./credential-modal-parts";

const AUTH0_TYPE = findCredentialType("AUTH0_M2M");

interface Auth0M2MCredentialModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: Auth0M2MFormData) => void;
  readonly onTest: (data: Auth0M2MFormData) => Promise<CredentialTestResult>;
  /** Delete this credential — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  readonly editing?: CredentialListItem | null;
  readonly loading?: boolean;
  /** Selectable environments; users can still create one that isn't listed. */
  readonly environments?: readonly string[];
  /** Scopes the client-id directory. Null while no org is selected. */
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

const DEFAULTS: Auth0M2MFormData = {
  name: "",
  environment: "DEVELOPMENT",
  domain: "",
  clientId: "",
  clientSecret: "",
  audience: "",
  scope: "",
  tokenRequestFormat: "FORM",
  tokenUrlOverride: "",
};

/**
 * Create/edit form for an Auth0 machine-to-machine credential.
 *
 * This is a preset over the generic OAuth2 grant rather than a new mechanism —
 * it persists as `OAUTH2_CLIENT_CREDENTIALS`. What the preset buys is the three
 * things operators get wrong on the generic form when the provider is Auth0:
 * the token endpoint is derived from the tenant domain instead of typed, the
 * audience is *required* (Auth0 issues an unvalidatable opaque token without
 * one), and the client id is picked from the directory instead of pasted.
 */
export function Auth0M2MCredentialModal({
  show,
  onClose,
  onSubmit,
  onTest,
  onDelete,
  editing = null,
  loading = false,
  environments = BUILT_IN_ENVIRONMENTS,
  orgSlug,
  dict,
}: Auth0M2MCredentialModalProps) {
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
  } = useForm<Auth0M2MFormData>({
    resolver: zodResolver(
      isEdit ? Auth0M2MCredentialEditSchema : Auth0M2MCredentialSchema
    ),
    defaultValues: DEFAULTS,
  });

  const domain = useWatch({ control, name: "domain" }) ?? "";
  const tokenUrlOverride = useWatch({ control, name: "tokenUrlOverride" }) ?? "";
  const effectiveTokenUrl = tokenUrlOverride.trim()
    ? tokenUrlOverride.trim()
    : buildAuth0TokenUrl(domain);

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    if (!show) return;
    setTestResult(null);
    if (!editing) {
      reset(DEFAULTS);
      return;
    }
    const config = editing.config as Auth0M2MConfig;
    // A credential stores the resolved endpoint. When it isn't the one the
    // domain would produce, it was an override and has to reopen as one —
    // otherwise saving an untouched form would silently rewrite the endpoint.
    const storedTokenUrl = config.tokenUrl ?? "";
    const storedDomain = config.domain ?? "";
    const derived = storedDomain ? buildAuth0TokenUrl(storedDomain) : "";
    reset({
      name: editing.name,
      environment: editing.environment,
      domain: storedDomain,
      clientId: config.clientId ?? "",
      clientSecret: "",
      audience: config.audience ?? "",
      scope: config.scope ?? "",
      tokenRequestFormat: config.tokenRequestFormat ?? "FORM",
      tokenUrlOverride:
        storedTokenUrl && storedTokenUrl !== derived ? storedTokenUrl : "",
    });
  }, [show, editing, reset]);

  async function handleTest(data: Auth0M2MFormData) {
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
      title={
        isEdit
          ? tr("modal.auth0EditTitle", dict)
          : tr("modal.auth0AddTitle", dict)
      }
      subtitle={tr("modal.auth0Subtitle", dict)}
      icon={
        <CredentialTypeLogo
          logo={AUTH0_TYPE?.logo}
          alt={trDynamic("types.auth0M2M.name", dict)}
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
            id="auth0-name"
            label={tr("modal.name", dict)}
            error={trDynamic(errors.name?.message ?? "", dict)}
          >
            <TextInput
              id="auth0-name"
              placeholder={tr("modal.namePlaceholder", dict)}
              {...register("name")}
              color={errors.name ? "failure" : undefined}
            />
          </SettingsFormField>

          <SettingsFormField
            id="auth0-environment"
            label={tr("modal.environment", dict)}
            error={trDynamic(errors.environment?.message ?? "", dict)}
          >
            <Controller
              control={control}
              name="environment"
              render={({ field }) => (
                <EnvironmentSelect
                  id="auth0-environment"
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
          id="auth0-domain"
          label={tr("modal.auth0Domain", dict)}
          error={trDynamic(errors.domain?.message ?? "", dict)}
        >
          <TextInput
            id="auth0-domain"
            placeholder={tr("modal.auth0DomainPlaceholder", dict)}
            {...register("domain")}
            color={errors.domain ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.auth0DomainHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="auth0-client-id"
          label={tr("modal.auth0ClientId", dict)}
          error={trDynamic(errors.clientId?.message ?? "", dict)}
        >
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <M2MClientCombobox
                id="auth0-client-id"
                value={field.value}
                onChange={field.onChange}
                orgSlug={orgSlug}
                invalid={Boolean(errors.clientId)}
                dict={dict}
              />
            )}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.auth0ClientIdHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="auth0-secret"
          label={tr("modal.clientSecret", dict)}
          error={trDynamic(errors.clientSecret?.message ?? "", dict)}
        >
          <TextInput
            id="auth0-secret"
            type="password"
            autoComplete="new-password"
            placeholder={
              isEdit
                ? tr("modal.clientSecretEditPlaceholder", dict)
                : tr("modal.auth0ClientSecretPlaceholder", dict)
            }
            {...register("clientSecret")}
            color={errors.clientSecret ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="auth0-audience"
          label={tr("modal.auth0Audience", dict)}
          error={trDynamic(errors.audience?.message ?? "", dict)}
        >
          <TextInput
            id="auth0-audience"
            placeholder={tr("modal.audiencePlaceholder", dict)}
            {...register("audience")}
            color={errors.audience ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.auth0AudienceHelp", dict)}
          </p>
        </SettingsFormField>

        {/* The endpoint the credential will actually call, derived live. Shown
            rather than typed so a mistyped domain is visible before saving. */}
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {tr("modal.tokenEndpoint", dict)}
          </div>
          <code className="mt-1 block break-all font-mono text-xs text-gray-600 dark:text-gray-400">
            {effectiveTokenUrl}
          </code>
        </div>

        <details className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("modal.advanced", dict)}
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            <SettingsFormField
              id="auth0-scope"
              label={tr("modal.scopeOptional", dict)}
              error={trDynamic(errors.scope?.message ?? "", dict)}
            >
              <TextInput
                id="auth0-scope"
                placeholder={tr("modal.auth0ScopePlaceholder", dict)}
                {...register("scope")}
                color={errors.scope ? "failure" : undefined}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.auth0ScopeHelp", dict)}
              </p>
            </SettingsFormField>

            <SettingsFormField
              id="auth0-token-url-override"
              label={tr("modal.tokenUrlOverride", dict)}
              error={trDynamic(errors.tokenUrlOverride?.message ?? "", dict)}
            >
              <TextInput
                id="auth0-token-url-override"
                type="url"
                placeholder={tr("modal.auth0TokenUrlOverridePlaceholder", dict)}
                {...register("tokenUrlOverride")}
                color={errors.tokenUrlOverride ? "failure" : undefined}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.auth0TokenUrlOverrideHelp", dict)}
              </p>
            </SettingsFormField>

            <SettingsFormField
              id="auth0-token-format"
              label={tr("modal.tokenRequestFormat", dict)}
            >
              <Select id="auth0-token-format" {...register("tokenRequestFormat")}>
                <option value="FORM">{tr("modal.tokenFormatForm", dict)}</option>
                <option value="JSON">{tr("modal.tokenFormatJson", dict)}</option>
              </Select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.auth0TokenRequestFormatHelp", dict)}
              </p>
            </SettingsFormField>
          </div>
        </details>

        {AUTH0_TYPE?.supportsTest && (
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
