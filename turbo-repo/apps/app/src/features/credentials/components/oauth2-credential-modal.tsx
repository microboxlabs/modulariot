"use client";

import { TextInput } from "flowbite-react";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  OAuth2CredentialEditSchema,
  OAuth2CredentialSchema,
  type CredentialListItem,
  type OAuth2Config,
  type OAuth2FormData,
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
  TokenRequestFormatField,
} from "./credential-modal-parts";

const CHROME: CredentialFormChrome = {
  typeId: "OAUTH2_CLIENT_CREDENTIALS",
  idPrefix: "oauth2",
  addTitleKey: "modal.oauth2AddTitle",
  editTitleKey: "modal.oauth2EditTitle",
  subtitleKey: "modal.oauth2Subtitle",
  logoAltKey: "types.oauth2.name",
};

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

function toFormValues(editing: CredentialListItem): OAuth2FormData {
  const config = editing.config as OAuth2Config;
  return {
    name: editing.name,
    environment: editing.environment,
    tokenUrl: config.tokenUrl ?? "",
    clientId: config.clientId ?? "",
    clientSecret: "",
    audience: config.audience ?? "",
    scope: config.scope ?? "",
    tokenRequestFormat: config.tokenRequestFormat ?? "FORM",
  };
}

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
export function OAuth2CredentialModal(
  props: CredentialModalProps<OAuth2FormData>
) {
  const { dict } = props;
  const state = useCredentialForm<OAuth2FormData>({
    ...props,
    defaults: DEFAULTS,
    schema: OAuth2CredentialSchema,
    editSchema: OAuth2CredentialEditSchema,
    toFormValues,
  });

  const {
    register,
    formState: { errors },
  } = state.form;

  return (
    <CredentialFormShell {...props} chrome={CHROME} state={state}>
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
        label={tr("modal.oauth2ClientId", dict)}
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
            state.isEdit
              ? tr("modal.clientSecretEditPlaceholder", dict)
              : tr("modal.oauth2ClientSecretPlaceholder", dict)
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
          placeholder={tr("modal.oauth2ScopePlaceholder", dict)}
          {...register("scope")}
          color={errors.scope ? "failure" : undefined}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.scopeOptionalHelp", dict)}
        </p>
      </SettingsFormField>

      <AdvancedSection dict={dict}>
        <TokenRequestFormatField
          id="oauth2-token-format"
          registration={register("tokenRequestFormat")}
          helpKey="modal.tokenRequestFormatHelp"
          dict={dict}
        />
      </AdvancedSection>
    </CredentialFormShell>
  );
}
