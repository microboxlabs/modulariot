"use client";

import { useState } from "react";
import { Checkbox, Label, Select, TextInput } from "flowbite-react";
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
import type { ChannelModalProps } from "@/features/settings-admin/channels/channel-card";
import {
  GEOCODING_DEFAULTS,
  GeocodingConnectionSchema,
  type GeocodingFormData,
} from "./geocoding-connection";

interface GeocodingConnectionModalProps extends ChannelModalProps<GeocodingFormData> {
  readonly dict: I18nRecord;
}

/** Create or edit the organization's geocoding connection: provider, token, storage mode and price. */
export function GeocodingConnectionModal({
  show,
  mode,
  initial,
  onClose,
  onSubmit,
  loading,
  error,
  dict,
}: Readonly<GeocodingConnectionModalProps>) {
  const isEdit = mode === "edit";
  const [tokenMissing, setTokenMissing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<GeocodingFormData>({
    resolver: zodResolver(GeocodingConnectionSchema),
    defaultValues: GEOCODING_DEFAULTS,
  });
  useSettingsModalFormOpenReset({
    show,
    isEdit,
    initial,
    defaults: GEOCODING_DEFAULTS,
    dict,
    reset,
  });
  const provider = watch("provider");
  const chrome = settingsModalChrome(isEdit, dict);

  const submit = (form: GeocodingFormData) => {
    const missing = !isEdit && form.token.trim() === "";
    setTokenMissing(missing);
    if (!missing) onSubmit(form);
  };

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={chrome.title}
      subtitle={chrome.subtitle}
      submitLabel={settingsModalSubmitLabel(loading, isEdit, dict)}
      isProcessing={loading}
      error={error}
      onSubmit={handleSubmit(submit)}
      size="2xl"
      showCancelButton
      cancelLabel={chrome.cancelLabel}
    >
      <div className="flex flex-col gap-4">
        <SettingsFormField
          id="geocoding-name"
          label={tr("modal.name", dict)}
          error={trDynamic(errors.name?.message ?? "", dict)}
        >
          <TextInput
            id="geocoding-name"
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
        </SettingsFormField>

        <SettingsFormField
          id="geocoding-provider"
          label={tr("modal.provider", dict)}
        >
          <Select id="geocoding-provider" {...register("provider")}>
            <option value="mapbox">Mapbox</option>
            <option value="google">Google</option>
          </Select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {trDynamic(`modal.providerHelp.${provider}`, dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="geocoding-token"
          label={tr("modal.token", dict)}
          error={tokenMissing ? tr("validation.tokenRequired", dict) : ""}
        >
          <TextInput
            id="geocoding-token"
            type="password"
            autoComplete="off"
            className="font-mono"
            placeholder={isEdit ? tr("modal.tokenKeep", dict) : ""}
            {...register("token")}
            color={tokenMissing ? "failure" : undefined}
          />
        </SettingsFormField>

        {provider === "mapbox" && (
          <div className="flex items-start gap-2">
            <Checkbox id="geocoding-permanent" {...register("permanent")} />
            <div className="flex flex-col">
              <Label htmlFor="geocoding-permanent">
                {tr("modal.permanent", dict)}
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.permanentHelp", dict)}
              </p>
            </div>
          </div>
        )}

        <SettingsFormField
          id="geocoding-cost"
          label={tr("modal.cost", dict)}
          error={trDynamic(errors.cost?.message ?? "", dict)}
        >
          <TextInput
            id="geocoding-cost"
            inputMode="decimal"
            placeholder="0.005"
            {...register("cost")}
            color={errors.cost ? "failure" : undefined}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.costHelp", dict)}
          </p>
        </SettingsFormField>
      </div>
    </FormModal>
  );
}
