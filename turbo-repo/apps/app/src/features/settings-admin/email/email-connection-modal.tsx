"use client";

import { Select, TextInput } from "flowbite-react";
import useSWR from "swr";
import { fetchCredentials } from "@/features/credentials/credentials-data-service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  settingsModalChrome,
  settingsModalSubmitLabel,
  useSettingsModalFormOpenReset,
} from "@/features/settings-admin/hooks/use-settings-modal-form";
import type { ChannelModalProps } from "../channels/channel-card";
import {
  NEW_KEY,
  EMAIL_DEFAULTS,
  EmailConnectionSchema,
  EmailEditSchema,
  type EmailFormData,
} from "./email.types";

interface EmailConnectionModalProps extends ChannelModalProps<EmailFormData> {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

/** Create or edit the organization's Resend connection. */
export function EmailConnectionModal({
  show,
  mode,
  initial,
  onClose,
  onSubmit,
  loading,
  error,
  orgSlug,
  dict,
}: EmailConnectionModalProps) {
  const isEdit = mode === "edit";
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(isEdit ? EmailEditSchema : EmailConnectionSchema),
    defaultValues: EMAIL_DEFAULTS,
  });

  useSettingsModalFormOpenReset({
    show,
    isEdit,
    initial,
    defaults: EMAIL_DEFAULTS,
    dict,
    reset,
  });

  const chrome = settingsModalChrome(isEdit, dict);
  const credentials = useSWR(
    show && orgSlug ? ["resend-credentials", orgSlug] : null,
    () => fetchCredentials(orgSlug ?? ""),
    { revalidateOnFocus: false }
  );
  const resendKeys = (credentials.data ?? []).filter(
    (c) => c.typeId === "RESEND"
  );
  const credentialId = watch("credentialId");
  // A key goes into a new credential, or rotates the one linked now.
  const showKey =
    credentialId === NEW_KEY ||
    (isEdit && credentialId === initial?.credentialId);

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={chrome.title}
      subtitle={chrome.subtitle}
      submitLabel={settingsModalSubmitLabel(loading, isEdit, dict)}
      isProcessing={loading}
      error={error}
      onSubmit={handleSubmit(onSubmit)}
      size="2xl"
      showCancelButton
      cancelLabel={chrome.cancelLabel}
    >
      <div className="flex flex-col gap-4">
        <SettingsFormField
          id="email-name"
          label={tr("modal.name", dict)}
          error={trDynamic(errors.name?.message ?? "", dict)}
        >
          <TextInput
            id="email-name"
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="email-from"
          label={tr("modal.from", dict)}
          error={trDynamic(errors.from?.message ?? "", dict)}
        >
          <TextInput
            id="email-from"
            placeholder={tr("modal.fromPlaceholder", dict)}
            {...register("from")}
            color={errors.from ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.fromHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="email-credential"
          label={tr("modal.credential", dict)}
        >
          <Select id="email-credential" {...register("credentialId")}>
            {!isEdit && (
              <option value={NEW_KEY}>{tr("modal.credentialNew", dict)}</option>
            )}
            {isEdit &&
              initial?.credentialId &&
              !resendKeys.some((c) => c.id === initial.credentialId) && (
                <option value={initial.credentialId}>
                  {tr("modal.credentialCurrent", dict)}
                </option>
              )}
            {resendKeys.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </SettingsFormField>

        {showKey && (
          <SettingsFormField
            id="email-token"
            label={tr("modal.token", dict)}
            error={trDynamic(errors.token?.message ?? "", dict)}
          >
            <TextInput
              id="email-token"
              type="password"
              autoComplete="off"
              placeholder={
                isEdit
                  ? tr("modal.tokenEditPlaceholder", dict)
                  : tr("modal.tokenPlaceholder", dict)
              }
              {...register("token")}
              color={errors.token ? "failure" : undefined}
            />
          </SettingsFormField>
        )}

        <SettingsFormField
          id="email-base"
          label={tr("modal.baseUrl", dict)}
          error={trDynamic(errors.baseUrl?.message ?? "", dict)}
        >
          <TextInput
            id="email-base"
            {...register("baseUrl")}
            color={errors.baseUrl ? "failure" : undefined}
          />
        </SettingsFormField>
      </div>
    </FormModal>
  );
}
