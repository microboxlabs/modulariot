"use client";

import { TextInput } from "flowbite-react";
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
  EMAIL_DEFAULTS,
  EmailConnectionSchema,
  EmailEditSchema,
  type EmailFormData,
} from "./email.types";

interface EmailConnectionModalProps extends ChannelModalProps<EmailFormData> {
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
  dict,
}: EmailConnectionModalProps) {
  const isEdit = mode === "edit";
  const {
    register,
    handleSubmit,
    reset,
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
