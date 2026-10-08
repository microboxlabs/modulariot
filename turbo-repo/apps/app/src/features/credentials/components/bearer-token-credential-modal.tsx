"use client";

import { TextInput } from "flowbite-react";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  BearerTokenCredentialEditSchema,
  BearerTokenCredentialSchema,
  RESEND_PROVIDER,
  ResendCredentialEditSchema,
  ResendCredentialSchema,
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

const BEARER_CHROME: CredentialFormChrome = {
  typeId: "BEARER_TOKEN",
  idPrefix: "bearer",
  addTitleKey: "modal.bearerAddTitle",
  editTitleKey: "modal.bearerEditTitle",
  subtitleKey: "modal.bearerSubtitle",
  logoAltKey: "types.bearer.name",
};

const RESEND_CHROME: CredentialFormChrome = {
  typeId: "RESEND",
  idPrefix: "resend",
  addTitleKey: "modal.resendAddTitle",
  editTitleKey: "modal.resendEditTitle",
  subtitleKey: "modal.resendSubtitle",
  logoAltKey: "types.resend.name",
};

interface TokenVariant {
  readonly chrome: CredentialFormChrome;
  readonly provider?: string;
  readonly schema: typeof BearerTokenCredentialSchema;
  readonly editSchema: typeof BearerTokenCredentialEditSchema;
  readonly helpKey: "modal.tokenHelp" | "modal.resendTokenHelp";
}

const BEARER: TokenVariant = {
  chrome: BEARER_CHROME,
  schema: BearerTokenCredentialSchema,
  editSchema: BearerTokenCredentialEditSchema,
  helpKey: "modal.tokenHelp",
};

const RESEND: TokenVariant = {
  chrome: RESEND_CHROME,
  provider: RESEND_PROVIDER,
  schema: ResendCredentialSchema,
  editSchema: ResendCredentialEditSchema,
  helpKey: "modal.resendTokenHelp",
};

/** Create/edit form for a static bearer token. The token is write-only. */
export function BearerTokenCredentialModal(
  props: CredentialModalProps<BearerTokenFormData>
) {
  return <TokenCredentialModal {...props} variant={BEARER} />;
}

/** Create/edit form for a Resend API key: a bearer token tagged as Resend. */
export function ResendCredentialModal(
  props: CredentialModalProps<BearerTokenFormData>
) {
  return <TokenCredentialModal {...props} variant={RESEND} />;
}

function TokenCredentialModal(
  props: CredentialModalProps<BearerTokenFormData> & {
    readonly variant: TokenVariant;
  }
) {
  const { dict, variant } = props;
  const defaults: BearerTokenFormData = {
    name: "",
    environment: "DEVELOPMENT",
    token: "",
    ...(variant.provider ? { provider: variant.provider } : {}),
  };
  const state = useCredentialForm<BearerTokenFormData>({
    ...props,
    defaults,
    schema: variant.schema,
    editSchema: variant.editSchema,
    toFormValues: (editing: CredentialListItem) => ({
      ...defaults,
      name: editing.name,
      environment: editing.environment,
    }),
  });

  const {
    register,
    formState: { errors },
  } = state.form;

  return (
    <CredentialFormShell {...props} chrome={variant.chrome} state={state}>
      <SettingsFormField
        id={`${variant.chrome.idPrefix}-token`}
        label={tr("modal.token", dict)}
        error={trDynamic(errors.token?.message ?? "", dict)}
      >
        <TextInput
          id={`${variant.chrome.idPrefix}-token`}
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
          {trDynamic(variant.helpKey, dict)}
        </p>
      </SettingsFormField>
    </CredentialFormShell>
  );
}
