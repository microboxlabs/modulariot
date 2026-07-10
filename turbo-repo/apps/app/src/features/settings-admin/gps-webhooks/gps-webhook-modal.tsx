"use client";

import { Label, Textarea, TextInput, ToggleSwitch } from "flowbite-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  GpsWebhookFormSchema,
  type GpsWebhookFormData,
} from "./gps-webhook.types";

interface GpsWebhookModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: GpsWebhookFormData) => void;
  readonly mode?: "create" | "edit";
  readonly initial?: GpsWebhookFormData | null;
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly dict: I18nRecord;
}

const DEFAULTS: GpsWebhookFormData = {
  name: "",
  url: "",
  filterMode: "ALL_VISIBLE",
  assetIds: "",
  carrierIds: "",
  ingestClientIds: "",
  gpsProviders: "",
  owners: "",
  enabled: true,
};

export function GpsWebhookModal({
  show,
  onClose,
  onSubmit,
  mode = "create",
  initial = null,
  loading = false,
  error = null,
  dict,
}: GpsWebhookModalProps) {
  const isEdit = mode === "edit";
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<GpsWebhookFormData>({
    resolver: zodResolver(GpsWebhookFormSchema),
    defaultValues: DEFAULTS,
  });

  const filterMode = watch("filterMode");
  const wasOpen = useRef(false);

  useEffect(() => {
    if (show && !wasOpen.current) {
      reset(
        isEdit && initial
          ? initial
          : { ...DEFAULTS, name: tr("modal.defaultName", dict) },
      );
    }
    wasOpen.current = show;
  }, [show, isEdit, initial, reset, dict]);

  let submitLabel: string;
  if (loading) {
    submitLabel = tr("modal.saving", dict);
  } else if (isEdit) {
    submitLabel = tr("modal.saveButton", dict);
  } else {
    submitLabel = tr("modal.createButton", dict);
  }

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={
        isEdit ? tr("modal.editTitle", dict) : tr("modal.addTitle", dict)
      }
      subtitle={
        isEdit ? tr("modal.editSubtitle", dict) : tr("modal.subtitle", dict)
      }
      submitLabel={submitLabel}
      isProcessing={loading}
      error={error}
      onSubmit={handleSubmit(onSubmit)}
      size="2xl"
      showCancelButton
      cancelLabel={tr("modal.cancel", dict)}
    >
      <div className="flex flex-col gap-4">
        <Field
          id="gps-wh-name"
          label={tr("modal.name", dict)}
          error={trDynamic(errors.name?.message ?? "", dict)}
        >
          <TextInput
            id="gps-wh-name"
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
        </Field>

        <Field
          id="gps-wh-url"
          label={tr("modal.url", dict)}
          error={trDynamic(errors.url?.message ?? "", dict)}
        >
          <TextInput
            id="gps-wh-url"
            placeholder={tr("modal.urlPlaceholder", dict)}
            {...register("url")}
            color={errors.url ? "failure" : undefined}
          />
        </Field>

        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <ToggleSwitch
              checked={field.value}
              label={tr("modal.enabledLabel", dict)}
              onChange={field.onChange}
            />
          )}
        />

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            {tr("modal.filterTitle", dict)}
          </p>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.filterHelp", dict)}
          </p>

          <div className="mb-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                value="ALL_VISIBLE"
                {...register("filterMode")}
              />
              {tr("modal.filterAllVisible", dict)}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" value="RULES" {...register("filterMode")} />
              {tr("modal.filterRules", dict)}
            </label>
          </div>

          {filterMode === "RULES" && (
            <div className="flex flex-col gap-3">
              <Field
                id="gps-wh-assets"
                label={tr("modal.assetIds", dict)}
                error={trDynamic(errors.assetIds?.message ?? "", dict)}
              >
                <Textarea
                  id="gps-wh-assets"
                  rows={2}
                  placeholder={tr("modal.listPlaceholder", dict)}
                  {...register("assetIds")}
                  color={errors.assetIds ? "failure" : undefined}
                />
              </Field>
              <Field
                id="gps-wh-carriers"
                label={tr("modal.carrierIds", dict)}
                error={trDynamic(errors.carrierIds?.message ?? "", dict)}
              >
                <Textarea
                  id="gps-wh-carriers"
                  rows={2}
                  placeholder={tr("modal.listPlaceholder", dict)}
                  {...register("carrierIds")}
                />
              </Field>
              <Field
                id="gps-wh-ingest"
                label={tr("modal.ingestClientIds", dict)}
                error={trDynamic(errors.ingestClientIds?.message ?? "", dict)}
              >
                <Textarea
                  id="gps-wh-ingest"
                  rows={2}
                  placeholder={tr("modal.listPlaceholder", dict)}
                  {...register("ingestClientIds")}
                />
              </Field>
              <Field
                id="gps-wh-vendors"
                label={tr("modal.gpsProviders", dict)}
                error={trDynamic(errors.gpsProviders?.message ?? "", dict)}
              >
                <Textarea
                  id="gps-wh-vendors"
                  rows={2}
                  placeholder={tr("modal.listPlaceholder", dict)}
                  {...register("gpsProviders")}
                />
              </Field>
              <Field
                id="gps-wh-owners"
                label={tr("modal.owners", dict)}
                error={trDynamic(errors.owners?.message ?? "", dict)}
              >
                <Textarea
                  id="gps-wh-owners"
                  rows={2}
                  placeholder={tr("modal.listPlaceholder", dict)}
                  {...register("owners")}
                />
              </Field>
            </div>
          )}
        </div>
      </div>
    </FormModal>
  );
}

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly children: ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block">
        {label}
      </Label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
