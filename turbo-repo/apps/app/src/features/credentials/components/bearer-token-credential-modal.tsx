"use client";

import { TextInput } from "flowbite-react";
import type { UseFormRegister } from "react-hook-form";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  BearerTokenCredentialEditSchema,
  BearerTokenCredentialSchema,
  GOOGLE_MAPS_PROVIDER,
  GoogleMapsCredentialEditSchema,
  GoogleMapsCredentialSchema,
  MAPBOX_PROVIDER,
  MapboxCredentialEditSchema,
  MapboxCredentialSchema,
  RESEND_PROVIDER,
  ResendCredentialEditSchema,
  ResendCredentialSchema,
  WHATSAPP_PROVIDER,
  WhatsAppCredentialEditSchema,
  WhatsAppCredentialSchema,
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

const WHATSAPP_CHROME: CredentialFormChrome = {
  typeId: "WHATSAPP",
  idPrefix: "whatsapp",
  addTitleKey: "modal.whatsappAddTitle",
  editTitleKey: "modal.whatsappEditTitle",
  subtitleKey: "modal.whatsappSubtitle",
  logoAltKey: "types.whatsapp.name",
};

const MAPBOX_CHROME: CredentialFormChrome = {
  typeId: "MAPBOX",
  idPrefix: "mapbox",
  addTitleKey: "modal.mapboxAddTitle",
  editTitleKey: "modal.mapboxEditTitle",
  subtitleKey: "modal.mapboxSubtitle",
  logoAltKey: "types.mapbox.name",
};

const GOOGLE_MAPS_CHROME: CredentialFormChrome = {
  typeId: "GOOGLE_MAPS",
  idPrefix: "google-maps",
  addTitleKey: "modal.googleMapsAddTitle",
  editTitleKey: "modal.googleMapsEditTitle",
  subtitleKey: "modal.googleMapsSubtitle",
  logoAltKey: "types.googleMaps.name",
};

interface TokenVariant {
  readonly chrome: CredentialFormChrome;
  readonly provider?: string;
  readonly schema: typeof BearerTokenCredentialSchema;
  readonly editSchema: typeof BearerTokenCredentialEditSchema;
  /** Also edits the Meta App secret and the webhook verify token. */
  readonly webhookKeys?: boolean;
  readonly helpKey:
    | "modal.tokenHelp"
    | "modal.resendTokenHelp"
    | "modal.whatsappTokenHelp"
    | "modal.mapboxTokenHelp"
    | "modal.googleMapsTokenHelp";
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

const WHATSAPP: TokenVariant = {
  chrome: WHATSAPP_CHROME,
  provider: WHATSAPP_PROVIDER,
  schema: WhatsAppCredentialSchema,
  editSchema: WhatsAppCredentialEditSchema,
  webhookKeys: true,
  helpKey: "modal.whatsappTokenHelp",
};

const MAPBOX: TokenVariant = {
  chrome: MAPBOX_CHROME,
  provider: MAPBOX_PROVIDER,
  schema: MapboxCredentialSchema,
  editSchema: MapboxCredentialEditSchema,
  helpKey: "modal.mapboxTokenHelp",
};

const GOOGLE_MAPS: TokenVariant = {
  chrome: GOOGLE_MAPS_CHROME,
  provider: GOOGLE_MAPS_PROVIDER,
  schema: GoogleMapsCredentialSchema,
  editSchema: GoogleMapsCredentialEditSchema,
  helpKey: "modal.googleMapsTokenHelp",
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

/** Create/edit form for a WhatsApp (Meta) access token: a bearer token tagged as WhatsApp. */
export function WhatsAppCredentialModal(
  props: CredentialModalProps<BearerTokenFormData>
) {
  return <TokenCredentialModal {...props} variant={WHATSAPP} />;
}

/** Create/edit form for a Mapbox access token: a bearer token tagged as Mapbox. */
export function MapboxCredentialModal(
  props: CredentialModalProps<BearerTokenFormData>
) {
  return <TokenCredentialModal {...props} variant={MAPBOX} />;
}

/** Create/edit form for a Google Maps Platform API key: a bearer token tagged as Google Maps. */
export function GoogleMapsCredentialModal(
  props: CredentialModalProps<BearerTokenFormData>
) {
  return <TokenCredentialModal {...props} variant={GOOGLE_MAPS} />;
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
    appSecret: "",
    verifyToken: "",
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
      {variant.webhookKeys && (
        <WebhookKeyFields
          idPrefix={variant.chrome.idPrefix}
          isEdit={state.isEdit}
          register={register}
          dict={dict}
        />
      )}
    </CredentialFormShell>
  );
}

/** The WhatsApp credential's Meta App secret and webhook verify token, both write-only. */
function WebhookKeyFields({
  idPrefix,
  isEdit,
  register,
  dict,
}: Readonly<{
  idPrefix: string;
  isEdit: boolean;
  register: UseFormRegister<BearerTokenFormData>;
  dict: I18nRecord;
}>) {
  const keep = tr("modal.webhookKeyEditPlaceholder", dict);
  return (
    <>
      <SettingsFormField
        id={`${idPrefix}-app-secret`}
        label={tr("modal.appSecret", dict)}
      >
        <TextInput
          id={`${idPrefix}-app-secret`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={isEdit ? keep : tr("modal.appSecretPlaceholder", dict)}
          {...register("appSecret")}
        />
      </SettingsFormField>
      <SettingsFormField
        id={`${idPrefix}-verify-token`}
        label={tr("modal.verifyToken", dict)}
      >
        <TextInput
          id={`${idPrefix}-verify-token`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={isEdit ? keep : tr("modal.verifyTokenPlaceholder", dict)}
          {...register("verifyToken")}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("modal.webhookKeysHelp", dict)}
        </p>
      </SettingsFormField>
    </>
  );
}
