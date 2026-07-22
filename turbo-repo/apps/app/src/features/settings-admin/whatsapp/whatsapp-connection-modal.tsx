"use client";

import { Textarea, TextInput, ToggleSwitch } from "flowbite-react";
import { Controller, useForm } from "react-hook-form";
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
import {
  DEFAULT_BASE_URL,
  DEFAULT_GRAPH_VERSION,
  WhatsAppConnectionSchema,
  WhatsAppEditSchema,
  type WhatsAppFormData,
} from "./whatsapp.types";

interface WhatsAppConnectionModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: WhatsAppFormData) => void;
  readonly mode?: "create" | "edit";
  readonly initial?: WhatsAppFormData | null;
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly dict: I18nRecord;
}

const DEFAULTS: WhatsAppFormData = {
  name: "",
  phoneNumberId: "",
  wabaId: "",
  graphVersion: DEFAULT_GRAPH_VERSION,
  baseUrl: DEFAULT_BASE_URL,
  token: "",
  testModeEnabled: false,
  testRecipients: "",
};

export function WhatsAppConnectionModal({
  show,
  onClose,
  onSubmit,
  mode = "create",
  initial = null,
  loading = false,
  error = null,
  dict,
}: WhatsAppConnectionModalProps) {
  const isEdit = mode === "edit";
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<WhatsAppFormData>({
    resolver: zodResolver(isEdit ? WhatsAppEditSchema : WhatsAppConnectionSchema),
    defaultValues: DEFAULTS,
  });

  const testModeEnabled = watch("testModeEnabled");

  // Initialize only when the modal opens (false → true). See useSettingsModalFormOpenReset.
  useSettingsModalFormOpenReset({
    show,
    isEdit,
    initial,
    defaults: DEFAULTS,
    dict,
    reset,
  });

  const submitLabel = settingsModalSubmitLabel(loading, isEdit, dict);
  const chrome = settingsModalChrome(isEdit, dict);

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={chrome.title}
      subtitle={chrome.subtitle}
      submitLabel={submitLabel}
      isProcessing={loading}
      error={error}
      onSubmit={handleSubmit(onSubmit)}
      size="2xl"
      showCancelButton
      cancelLabel={chrome.cancelLabel}
    >
      <div className="flex flex-col gap-4">
        <SettingsFormField
          id="wa-name"
          label={tr("modal.name", dict)}
          error={trDynamic(errors.name?.message ?? "", dict)}
        >
          <TextInput
            id="wa-name"
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="wa-phone"
          label={tr("modal.phoneNumberId", dict)}
          error={trDynamic(errors.phoneNumberId?.message ?? "", dict)}
        >
          <TextInput
            id="wa-phone"
            placeholder={tr("modal.phoneNumberIdPlaceholder", dict)}
            {...register("phoneNumberId")}
            color={errors.phoneNumberId ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="wa-waba"
          label={tr("modal.wabaId", dict)}
          error={trDynamic(errors.wabaId?.message ?? "", dict)}
        >
          <TextInput
            id="wa-waba"
            placeholder={tr("modal.wabaIdPlaceholder", dict)}
            {...register("wabaId")}
            color={errors.wabaId ? "failure" : undefined}
          />
        </SettingsFormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsFormField
            id="wa-graph"
            label={tr("modal.graphVersion", dict)}
            error={trDynamic(errors.graphVersion?.message ?? "", dict)}
          >
            <TextInput
              id="wa-graph"
              {...register("graphVersion")}
              color={errors.graphVersion ? "failure" : undefined}
            />
          </SettingsFormField>

          <SettingsFormField
            id="wa-base"
            label={tr("modal.baseUrl", dict)}
            error={trDynamic(errors.baseUrl?.message ?? "", dict)}
          >
            <TextInput
              id="wa-base"
              {...register("baseUrl")}
              color={errors.baseUrl ? "failure" : undefined}
            />
          </SettingsFormField>
        </div>

        <SettingsFormField
          id="wa-token"
          label={tr("modal.token", dict)}
          error={trDynamic(errors.token?.message ?? "", dict)}
        >
          <TextInput
            id="wa-token"
            type="password"
            placeholder={
              isEdit
                ? tr("modal.tokenEditPlaceholder", dict)
                : tr("modal.tokenPlaceholder", dict)
            }
            autoComplete="off"
            {...register("token")}
            color={errors.token ? "failure" : undefined}
          />
        </SettingsFormField>

        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <Controller
            control={control}
            name="testModeEnabled"
            render={({ field }) => (
              <ToggleSwitch
                checked={field.value}
                label={tr("modal.testModeLabel", dict)}
                onChange={field.onChange}
              />
            )}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.testModeHelp", dict)}
          </p>

          <div className="mt-3">
            <SettingsFormField
              id="wa-test-recipients"
              label={tr("modal.testRecipientsLabel", dict)}
              error={trDynamic(errors.testRecipients?.message ?? "", dict)}
            >
              <Textarea
                id="wa-test-recipients"
                rows={3}
                placeholder={tr("modal.testRecipientsPlaceholder", dict)}
                disabled={!testModeEnabled}
                {...register("testRecipients")}
                color={errors.testRecipients ? "failure" : undefined}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.testRecipientsHelp", dict)}
              </p>
            </SettingsFormField>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
