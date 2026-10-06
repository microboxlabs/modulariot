"use client";

import { useEffect } from "react";
import { Button, Select, TextInput } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import type { CredentialListItem } from "@/features/credentials/credential.types";
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
  type EmailFormData,
} from "./email.types";

interface EmailConnectionModalProps extends ChannelModalProps<EmailFormData> {
  /** The organization's Resend credentials. */
  readonly credentials: readonly CredentialListItem[];
  /** Set to select a credential just created. */
  readonly selectCredential: string | null;
  readonly onNewCredential: () => void;
  readonly dict: I18nRecord;
}

/** Create or edit the organization's email channel: sender and which Resend credential. */
export function EmailConnectionModal({
  show,
  mode,
  initial,
  onClose,
  onSubmit,
  loading,
  error,
  credentials,
  selectCredential,
  onNewCredential,
  dict,
}: EmailConnectionModalProps) {
  const isEdit = mode === "edit";
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(EmailConnectionSchema),
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

  useEffect(() => {
    if (selectCredential) {
      setValue("credentialId", selectCredential, { shouldValidate: true });
    }
  }, [selectCredential, setValue]);

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
          id="email-credential"
          label={tr("modal.credential", dict)}
          error={trDynamic(errors.credentialId?.message ?? "", dict)}
        >
          <div className="flex gap-2">
            <Select
              id="email-credential"
              className="flex-1"
              {...register("credentialId")}
              color={errors.credentialId ? "failure" : undefined}
            >
              <option value="">{tr("modal.credentialPick", dict)}</option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button color="alternative" size="sm" onClick={onNewCredential}>
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("modal.credentialNew", dict)}
            </Button>
          </div>
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
