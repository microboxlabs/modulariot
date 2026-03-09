"use client";

import { Button, Label, Select, TextInput, Textarea } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateDataSourceSchema, UpdateDataSourceSchema } from "../types";
import type { DataSourceListItem, DataSourceFormData } from "../types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useEffect, useMemo } from "react";
import FormModal from "@/features/common/components/form-modal/form-modal";

interface DataSourceModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: DataSourceFormData) => void;
  readonly onTest?: (id: string) => void;
  readonly editingSource?: DataSourceListItem | null;
  readonly loading?: boolean;
  readonly dict: I18nRecord;
}

export function DataSourceModal({
  show,
  onClose,
  onSubmit,
  onTest,
  editingSource,
  loading,
  dict,
}: DataSourceModalProps) {
  const schema = useMemo(
    () => (editingSource ? UpdateDataSourceSchema : CreateDataSourceSchema),
    [editingSource]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DataSourceFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "POSTGREST",
      description: "",
      url: "",
      token: "",
    },
  });

  useEffect(() => {
    if (editingSource) {
      reset({
        name: editingSource.name,
        type: editingSource.type,
        description: editingSource.description || "",
        url: editingSource.connectionConfig.url,
        token: "",
      });
    } else {
      reset({
        name: "",
        type: "POSTGREST",
        description: "",
        url: "",
        token: "",
      });
    }
  }, [editingSource, reset, show]);

  const submitLabel = loading
    ? tr("modal.saving", dict)
    : editingSource
      ? tr("modal.saveButton", dict)
      : tr("modal.createButton", dict);

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="lg"
      title={
        editingSource
          ? tr("modal.editTitle", dict)
          : tr("modal.addTitle", dict)
      }
      submitLabel={submitLabel}
      isProcessing={loading}
      onSubmit={handleSubmit(onSubmit)}
      showCancelButton
      cancelLabel={tr("cancel", dict)}
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">{tr("modal.name", dict)}</Label>
          <TextInput
            id="name"
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
          {errors.name?.message && (
            <p className="mt-1 text-sm text-red-600">{tr(errors.name.message, dict)}</p>
          )}
        </div>

        <div>
          <Label htmlFor="type">{tr("modal.type", dict)}</Label>
          <Select id="type" {...register("type")}>
            <option value="POSTGREST">PostgREST</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="description">{tr("modal.description", dict)}</Label>
          <Textarea
            id="description"
            {...register("description")}
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="url">{tr("modal.url", dict)}</Label>
          <TextInput
            id="url"
            type="url"
            placeholder="https://api.example.com"
            {...register("url")}
            color={errors.url ? "failure" : undefined}
          />
          {errors.url?.message && (
            <p className="mt-1 text-sm text-red-600">{tr(errors.url.message, dict)}</p>
          )}
        </div>

        <div>
          <Label htmlFor="token">{tr("modal.token", dict)}</Label>
          <TextInput
            id="token"
            type="password"
            placeholder={
              editingSource
                ? tr("modal.tokenPlaceholderEdit", dict)
                : undefined
            }
            {...register("token")}
            color={errors.token ? "failure" : undefined}
          />
          {errors.token?.message && (
            <p className="mt-1 text-sm text-red-600">{tr(errors.token.message, dict)}</p>
          )}
          {!errors.token?.message && editingSource && (
            <p className="mt-1 text-sm text-gray-500">{tr("modal.tokenHint", dict)}</p>
          )}
        </div>

        {editingSource && onTest && (
          <div>
            <Button
              color="light"
              onClick={() => onTest(editingSource.id)}
              disabled={loading}
            >
              {tr("modal.testConnection", dict)}
            </Button>
          </div>
        )}
      </div>
    </FormModal>
  );
}
