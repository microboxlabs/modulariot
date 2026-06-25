"use client";

import { Label, TextInput } from "flowbite-react";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  DEFAULT_BASE_URL,
  DEFAULT_GRAPH_VERSION,
  WhatsAppConnectionSchema,
  type WhatsAppFormData,
} from "./whatsapp.types";

interface WhatsAppConnectionModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: WhatsAppFormData) => void;
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly dict: I18nRecord;
}

const DEFAULTS: WhatsAppFormData = {
  name: "Canal WhatsApp",
  phoneNumberId: "",
  wabaId: "",
  graphVersion: DEFAULT_GRAPH_VERSION,
  baseUrl: DEFAULT_BASE_URL,
  token: "",
};

export function WhatsAppConnectionModal({
  show,
  onClose,
  onSubmit,
  loading = false,
  error = null,
  dict,
}: WhatsAppConnectionModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WhatsAppFormData>({
    resolver: zodResolver(WhatsAppConnectionSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (show) {
      reset(DEFAULTS);
    }
  }, [show, reset]);

  const submitLabel = loading
    ? tr("modal.saving", dict)
    : tr("modal.createButton", dict);

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={tr("modal.addTitle", dict)}
      subtitle={tr("modal.subtitle", dict)}
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
          id="wa-name"
          label={tr("modal.name", dict)}
          error={trDynamic(errors.name?.message ?? "", dict)}
        >
          <TextInput
            id="wa-name"
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
        </Field>

        <Field
          id="wa-phone"
          label={tr("modal.phoneNumberId", dict)}
          error={trDynamic(errors.phoneNumberId?.message ?? "", dict)}
        >
          <TextInput
            id="wa-phone"
            placeholder="1188646904321987"
            {...register("phoneNumberId")}
            color={errors.phoneNumberId ? "failure" : undefined}
          />
        </Field>

        <Field
          id="wa-waba"
          label={tr("modal.wabaId", dict)}
          error={trDynamic(errors.wabaId?.message ?? "", dict)}
        >
          <TextInput
            id="wa-waba"
            placeholder="1333560228881251"
            {...register("wabaId")}
            color={errors.wabaId ? "failure" : undefined}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="wa-graph"
            label={tr("modal.graphVersion", dict)}
            error={trDynamic(errors.graphVersion?.message ?? "", dict)}
          >
            <TextInput
              id="wa-graph"
              {...register("graphVersion")}
              color={errors.graphVersion ? "failure" : undefined}
            />
          </Field>

          <Field
            id="wa-base"
            label={tr("modal.baseUrl", dict)}
            error={trDynamic(errors.baseUrl?.message ?? "", dict)}
          >
            <TextInput
              id="wa-base"
              {...register("baseUrl")}
              color={errors.baseUrl ? "failure" : undefined}
            />
          </Field>
        </div>

        <Field
          id="wa-token"
          label={tr("modal.token", dict)}
          error={trDynamic(errors.token?.message ?? "", dict)}
        >
          <TextInput
            id="wa-token"
            type="password"
            placeholder={tr("modal.tokenPlaceholder", dict)}
            autoComplete="off"
            {...register("token")}
            color={errors.token ? "failure" : undefined}
          />
        </Field>
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
