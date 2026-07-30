"use client";

import { TextInput } from "flowbite-react";
import { Controller, useWatch } from "react-hook-form";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  Auth0M2MCredentialEditSchema,
  Auth0M2MCredentialSchema,
  buildAuth0TokenUrl,
  type Auth0M2MConfig,
  type Auth0M2MFormData,
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
import { M2MClientCombobox } from "./m2m-client-combobox";

const CHROME: CredentialFormChrome = {
  typeId: "AUTH0_M2M",
  idPrefix: "auth0",
  addTitleKey: "modal.auth0AddTitle",
  editTitleKey: "modal.auth0EditTitle",
  subtitleKey: "modal.auth0Subtitle",
  logoAltKey: "types.auth0M2M.name",
};

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

function toFormValues(editing: CredentialListItem): Auth0M2MFormData {
  const config = editing.config as Auth0M2MConfig;
  // A credential stores the resolved endpoint. When it isn't the one the domain
  // would produce, it was an override and has to reopen as one — otherwise
  // saving an untouched form would silently rewrite the endpoint.
  const storedTokenUrl = config.tokenUrl ?? "";
  const storedDomain = config.domain ?? "";
  const derived = storedDomain ? buildAuth0TokenUrl(storedDomain) : "";
  return {
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
  };
}

type Auth0M2MCredentialModalProps = CredentialModalProps<Auth0M2MFormData> & {
  /** Scopes the client-id directory. Null while no org is selected. */
  readonly orgSlug: string | null;
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
  orgSlug,
  ...props
}: Auth0M2MCredentialModalProps) {
  const { dict } = props;
  const state = useCredentialForm<Auth0M2MFormData>({
    ...props,
    defaults: DEFAULTS,
    schema: Auth0M2MCredentialSchema,
    editSchema: Auth0M2MCredentialEditSchema,
    toFormValues,
  });

  const {
    register,
    control,
    formState: { errors },
  } = state.form;

  const domain = useWatch({ control, name: "domain" }) ?? "";
  const tokenUrlOverride =
    useWatch({ control, name: "tokenUrlOverride" }) ?? "";

  return (
    <CredentialFormShell {...props} chrome={CHROME} state={state}>
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
            state.isEdit
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

      <TokenEndpointPreview
        url={
          tokenUrlOverride.trim()
            ? tokenUrlOverride.trim()
            : buildAuth0TokenUrl(domain)
        }
        dict={dict}
      />

      <AdvancedSection dict={dict}>
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

        <TokenRequestFormatField
          id="auth0-token-format"
          registration={register("tokenRequestFormat")}
          helpKey="modal.auth0TokenRequestFormatHelp"
          dict={dict}
        />
      </AdvancedSection>
    </CredentialFormShell>
  );
}
