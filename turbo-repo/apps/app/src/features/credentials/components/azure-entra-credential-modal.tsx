"use client";

import { TextInput } from "flowbite-react";
import { useWatch } from "react-hook-form";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  AzureEntraCredentialEditSchema,
  AzureEntraCredentialSchema,
  buildEntraTokenUrl,
  type AzureEntraConfig,
  type AzureEntraFormData,
  type CredentialListItem,
} from "../credential.types";
import {
  useCredentialForm,
  type CredentialModalProps,
} from "../use-credential-form";
import {
  CredentialFormShell,
  type CredentialFormChrome,
} from "./credential-form-shell";
import {
  AdvancedSection,
  TokenEndpointPreview,
  TokenRequestFormatField,
} from "./credential-modal-parts";

const CHROME: CredentialFormChrome = {
  typeId: "AZURE_ENTRA_CLIENT_CREDENTIALS",
  idPrefix: "cred",
  addTitleKey: "modal.addTitle",
  editTitleKey: "modal.editTitle",
  subtitleKey: "modal.subtitle",
  logoAltKey: "types.azureEntra.name",
};

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

function toFormValues(editing: CredentialListItem): AzureEntraFormData {
  const config = editing.config as AzureEntraConfig;
  return {
    name: editing.name,
    environment: editing.environment,
    tenantId: config.tenantId ?? "",
    clientId: config.clientId ?? "",
    clientSecret: "",
    scope: config.scope ?? "",
    tokenRequestFormat: config.tokenRequestFormat ?? "FORM",
    tokenUrlOverride: config.tokenUrlOverride ?? "",
  };
}

/**
 * Create/edit form for an Azure Entra (Microsoft Identity Platform)
 * client-credentials credential — the first credential type.
 *
 * The token endpoint is derived from the directory (tenant) id rather than
 * typed, so the URL can't drift from the tenant it belongs to; the override is
 * there for sovereign clouds and B2C policies.
 */
export function AzureEntraCredentialModal(
  props: CredentialModalProps<AzureEntraFormData>
) {
  const { dict } = props;
  const state = useCredentialForm<AzureEntraFormData>({
    ...props,
    defaults: DEFAULTS,
    schema: AzureEntraCredentialSchema,
    editSchema: AzureEntraCredentialEditSchema,
    toFormValues,
  });

  const {
    register,
    control,
    formState: { errors },
  } = state.form;

  const tenantId = useWatch({ control, name: "tenantId" }) ?? "";
  const tokenUrlOverride =
    useWatch({ control, name: "tokenUrlOverride" }) ?? "";

  return (
    <CredentialFormShell {...props} chrome={CHROME} state={state}>
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
            state.isEdit
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
        url={
          tokenUrlOverride.trim()
            ? tokenUrlOverride.trim()
            : buildEntraTokenUrl(tenantId)
        }
        dict={dict}
      />

      <AdvancedSection dict={dict}>
        <TokenRequestFormatField
          id="cred-token-format"
          registration={register("tokenRequestFormat")}
          dict={dict}
        />

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
      </AdvancedSection>
    </CredentialFormShell>
  );
}
