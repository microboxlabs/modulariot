"use client";

import { Textarea, TextInput } from "flowbite-react";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  GoogleServiceAccountCredentialEditSchema,
  GoogleServiceAccountCredentialSchema,
  type CredentialListItem,
  type GoogleServiceAccountConfig,
  type GoogleServiceAccountFormData,
} from "../credential.types";
import {
  useCredentialForm,
  type CredentialModalProps,
} from "../use-credential-form";
import {
  CredentialFormShell,
  type CredentialFormChrome,
} from "./credential-form-shell";

const CHROME: CredentialFormChrome = {
  typeId: "GOOGLE_SERVICE_ACCOUNT",
  idPrefix: "gsa",
  addTitleKey: "modal.googleAddTitle",
  editTitleKey: "modal.googleEditTitle",
  subtitleKey: "modal.googleSubtitle",
  logoAltKey: "types.googleServiceAccount.name",
};

const DEFAULTS: GoogleServiceAccountFormData = {
  name: "",
  environment: "DEVELOPMENT",
  projectId: "",
  clientEmail: "",
  privateKey: "",
  scope: "",
};

function toFormValues(
  editing: CredentialListItem
): GoogleServiceAccountFormData {
  const config = editing.config as GoogleServiceAccountConfig;
  return {
    name: editing.name,
    environment: editing.environment,
    projectId: config.projectId ?? "",
    clientEmail: config.clientEmail ?? "",
    privateKey: "",
    scope: config.scope ?? "",
  };
}

/**
 * Create/edit form for a Google service account, the credential a BigQuery
 * datasource names. The three fields are copied from the account's JSON key
 * file; the key is write-only, like every other secret here.
 */
export function GoogleServiceAccountCredentialModal(
  props: CredentialModalProps<GoogleServiceAccountFormData>
) {
  const { dict } = props;
  const state = useCredentialForm<GoogleServiceAccountFormData>({
    ...props,
    defaults: DEFAULTS,
    schema: GoogleServiceAccountCredentialSchema,
    editSchema: GoogleServiceAccountCredentialEditSchema,
    toFormValues,
  });

  const {
    register,
    formState: { errors },
  } = state.form;

  return (
    <CredentialFormShell {...props} chrome={CHROME} state={state}>
      <SettingsFormField
        id="gsa-project"
        label={tr("modal.projectId", dict)}
        error={trDynamic(errors.projectId?.message ?? "", dict)}
      >
        <TextInput
          id="gsa-project"
          placeholder={tr("modal.projectIdPlaceholder", dict)}
          {...register("projectId")}
          color={errors.projectId ? "failure" : undefined}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.projectIdHelp", dict)}
        </p>
      </SettingsFormField>

      <SettingsFormField
        id="gsa-email"
        label={tr("modal.clientEmail", dict)}
        error={trDynamic(errors.clientEmail?.message ?? "", dict)}
      >
        <TextInput
          id="gsa-email"
          type="email"
          placeholder={tr("modal.clientEmailPlaceholder", dict)}
          {...register("clientEmail")}
          color={errors.clientEmail ? "failure" : undefined}
        />
      </SettingsFormField>

      <SettingsFormField
        id="gsa-key"
        label={tr("modal.privateKey", dict)}
        error={trDynamic(errors.privateKey?.message ?? "", dict)}
      >
        <Textarea
          id="gsa-key"
          rows={5}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            state.isEdit
              ? tr("modal.privateKeyEditPlaceholder", dict)
              : tr("modal.privateKeyPlaceholder", dict)
          }
          {...register("privateKey")}
          color={errors.privateKey ? "failure" : undefined}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.privateKeyHelp", dict)}
        </p>
      </SettingsFormField>

      <SettingsFormField
        id="gsa-scope"
        label={tr("modal.scopeOptional", dict)}
        error={trDynamic(errors.scope?.message ?? "", dict)}
      >
        <TextInput
          id="gsa-scope"
          placeholder="https://www.googleapis.com/auth/bigquery.readonly"
          {...register("scope")}
          color={errors.scope ? "failure" : undefined}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.googleScopeHelp", dict)}
        </p>
      </SettingsFormField>
    </CredentialFormShell>
  );
}
