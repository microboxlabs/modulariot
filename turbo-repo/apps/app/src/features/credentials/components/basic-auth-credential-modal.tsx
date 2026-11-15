"use client";

import { TextInput } from "flowbite-react";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  BasicAuthCredentialEditSchema,
  BasicAuthCredentialSchema,
  type BasicAuthConfig,
  type BasicAuthFormData,
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
  typeId: "BASIC_AUTH",
  idPrefix: "basic",
  addTitleKey: "modal.basicAddTitle",
  editTitleKey: "modal.basicEditTitle",
  subtitleKey: "modal.basicSubtitle",
  logoAltKey: "types.basic.name",
};

const DEFAULTS: BasicAuthFormData = {
  name: "",
  environment: "DEVELOPMENT",
  username: "",
  password: "",
};

function toFormValues(editing: CredentialListItem): BasicAuthFormData {
  const config = editing.config as BasicAuthConfig;
  return {
    name: editing.name,
    environment: editing.environment,
    username: config.username ?? "",
    password: "",
  };
}

/** Create/edit form for HTTP basic authentication. The password is write-only. */
export function BasicAuthCredentialModal(
  props: CredentialModalProps<BasicAuthFormData>
) {
  const { dict } = props;
  const state = useCredentialForm<BasicAuthFormData>({
    ...props,
    defaults: DEFAULTS,
    schema: BasicAuthCredentialSchema,
    editSchema: BasicAuthCredentialEditSchema,
    toFormValues,
  });

  const {
    register,
    formState: { errors },
  } = state.form;

  return (
    <CredentialFormShell {...props} chrome={CHROME} state={state}>
      <SettingsFormField
        id="basic-username"
        label={tr("modal.username", dict)}
        error={trDynamic(errors.username?.message ?? "", dict)}
      >
        <TextInput
          id="basic-username"
          autoComplete="off"
          spellCheck={false}
          placeholder={tr("modal.usernamePlaceholder", dict)}
          {...register("username")}
          color={errors.username ? "failure" : undefined}
        />
      </SettingsFormField>
      <SettingsFormField
        id="basic-password"
        label={tr("modal.password", dict)}
        error={trDynamic(errors.password?.message ?? "", dict)}
      >
        <TextInput
          id="basic-password"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          placeholder={
            state.isEdit
              ? tr("modal.passwordEditPlaceholder", dict)
              : tr("modal.passwordPlaceholder", dict)
          }
          {...register("password")}
          color={errors.password ? "failure" : undefined}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.passwordHelp", dict)}
        </p>
      </SettingsFormField>
    </CredentialFormShell>
  );
}
