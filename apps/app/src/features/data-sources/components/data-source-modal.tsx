"use client";

import { Button, Label, Modal, ModalHeader, ModalBody, ModalFooter, Select, TextInput, Textarea } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateDataSourceSchema, UpdateDataSourceSchema } from "../types";
import type { DataSourceListItem, DataSourceFormData } from "../types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useEffect, useMemo } from "react";

interface DataSourceModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: DataSourceFormData) => void;
  onTest?: (id: string) => void;
  editingSource?: DataSourceListItem | null;
  loading?: boolean;
  dict: I18nRecord;
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

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <ModalHeader>
        {editingSource
          ? tr("modal.editTitle", dict)
          : tr("modal.addTitle", dict)}
      </ModalHeader>
      <ModalBody>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          id="data-source-form"
        >
          <div>
            <Label htmlFor="name">{tr("modal.name", dict)}</Label>
            <TextInput
              id="name"
              {...register("name")}
              color={errors.name ? "failure" : undefined}
            />
            {errors.name?.message && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
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
              <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
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
              <p className="mt-1 text-sm text-red-600">{errors.token.message}</p>
            )}
            {!errors.token?.message && editingSource && (
              <p className="mt-1 text-sm text-gray-500">{tr("modal.tokenHint", dict)}</p>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <div className="flex w-full justify-between">
          <div>
            {editingSource && onTest && (
              <Button
                color="light"
                onClick={() => onTest(editingSource.id)}
                disabled={loading}
              >
                {tr("modal.testConnection", dict)}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button color="gray" onClick={onClose}>
              {tr("cancel", dict)}
            </Button>
            <Button
              type="submit"
              form="data-source-form"
              disabled={loading}
            >
              {loading
                ? tr("modal.saving", dict)
                : editingSource
                  ? tr("modal.saveButton", dict)
                  : tr("modal.createButton", dict)}
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
