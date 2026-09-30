"use client";

import { TextInput } from "flowbite-react";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  BearerTokenCredentialEditSchema,
  BearerTokenCredentialSchema,
  type BearerTokenFormData,
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

const CHROME: CredentialFormChrome = {
  typeId: "BEARER_TOKEN",
  idPrefix: "bearer",
  addTitleKey: "modal.bearerAddTitle",
  editTitleKey: "modal.bearerEditTitle",
  subtitleKey: "modal.bearerSubtitle",
  logoAltKey: "types.bearer.name",
};

const DEFAULTS: BearerTokenFormData = {
  name: "",
  environment: "DEVELOPMENT",
  token: "",
};

function toFormValues(editing: CredentialListItem): BearerTokenFormData {
  return { name: editing.name, environment: editing.environment, token: "" };
}

/** Create/edit form for a static bearer token. The token is write-only. */
export function BearerTokenCredentialModal(
  props: CredentialModalProps<BearerTokenFormData>
) {
  const { dict } = props;
  const state = useCredentialForm<BearerTokenFormData>({
    ...props,
    defaults: DEFAULTS,
    schema: BearerTokenCredentialSchema,
    editSchema: BearerTokenCredentialEditSchema,
    toFormValues,
  });

  const {
    register,
    formState: { errors },
  } = state.form;

  return (
    <CredentialFormShell {...props} chrome={CHROME} state={state}>
      <SettingsFormField
        id="bearer-token"
        label={tr("modal.token", dict)}
        error={trDynamic(errors.token?.message ?? "", dict)}
      >
        <TextInput
          id="bearer-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            state.isEdit
              ? tr("modal.tokenEditPlaceholder", dict)
              : tr("modal.tokenPlaceholder", dict)
          }
          {...register("token")}
          color={errors.token ? "failure" : undefined}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.tokenHelp", dict)}
        </p>
      </SettingsFormField>
    </CredentialFormShell>
  );
}
