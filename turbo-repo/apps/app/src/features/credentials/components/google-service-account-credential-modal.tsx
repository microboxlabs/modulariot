"use client";

import { useRef, useState } from "react";
import { Button, Textarea, TextInput } from "flowbite-react";
import { HiUpload } from "react-icons/hi";
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
import { parseServiceAccountKeyFile } from "./service-account-key-file";

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
 * datasource names. The three fields come from the account's JSON key file,
 * loaded in the browser or copied by hand; the key is write-only, like every
 * other secret here.
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
    setValue,
    getValues,
    formState: { errors },
  } = state.form;
  const fileInput = useRef<HTMLInputElement>(null);
  const [keyFile, setKeyFile] = useState<
    { ok: true; name: string } | { ok: false } | null
  >(null);

  async function loadKeyFile(file: File | undefined) {
    if (!file) return;
    const fields = parseServiceAccountKeyFile(await file.text());
    if (!fields) {
      setKeyFile({ ok: false });
      return;
    }
    const options = { shouldDirty: true, shouldValidate: true };
    setValue("projectId", fields.projectId, options);
    setValue("clientEmail", fields.clientEmail, options);
    setValue("privateKey", fields.privateKey, options);
    if (!getValues("name").trim())
      setValue("name", fields.clientEmail.split("@")[0], options);
    setKeyFile({ ok: true, name: file.name });
  }

  return (
    <CredentialFormShell {...props} chrome={CHROME} state={state}>
      <div
        className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void loadKeyFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="gsa-key-file"
          onChange={(event) => {
            void loadKeyFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          color="light"
          size="sm"
          onClick={() => fileInput.current?.click()}
        >
          <HiUpload className="mr-2 h-4 w-4" />
          {tr("modal.keyFileLoad", dict)}
        </Button>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.keyFileHelp", dict)}
        </p>
        {keyFile?.ok === true && (
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">
            {tr("modal.keyFileLoaded", dict, { file: keyFile.name })}
          </p>
        )}
        {keyFile?.ok === false && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {tr("modal.keyFileInvalid", dict)}
          </p>
        )}
      </div>

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
          placeholder="https://www.googleapis.com/auth/bigquery"
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
