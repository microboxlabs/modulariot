"use client";

import { Button, Label, Select, TextInput, Textarea } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateDataSourceSchema, UpdateDataSourceSchema } from "../types";
import type {
  DataSourceListItem,
  DataSourceFormData,
  AuthMethod,
} from "../types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<DataSourceFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "POSTGREST",
      description: "",
      url: "",
      authMethod: "TOKEN",
      token: "",
      clientId: "",
      clientSecret: "",
      tokenUrl: "",
      scope: "",
      audience: "",
    },
  });

  const authMethod = watch("authMethod");

  useEffect(() => {
    if (editingSource) {
      reset({
        name: editingSource.name,
        type: editingSource.type,
        description: editingSource.description || "",
        url: editingSource.connectionConfig.url,
        authMethod: editingSource.authMethod || "TOKEN",
        token: "",
        clientId: editingSource.connectionConfig.clientId || "",
        clientSecret: "",
        tokenUrl: editingSource.connectionConfig.tokenUrl || "",
        scope: editingSource.connectionConfig.scope || "",
        audience: editingSource.connectionConfig.audience || "",
      });
    } else {
      reset({
        name: "",
        type: "POSTGREST",
        description: "",
        url: "",
        authMethod: "TOKEN",
        token: "",
        clientId: "",
        clientSecret: "",
        tokenUrl: "",
        scope: "",
        audience: "",
      });
    }
  }, [editingSource, reset, show]);

  let submitLabel: string;
  if (loading) {
    submitLabel = tr("modal.saving", dict);
  } else if (editingSource) {
    submitLabel = tr("modal.saveButton", dict);
  } else {
    submitLabel = tr("modal.createButton", dict);
  }

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="4xl"
      title={
        editingSource ? tr("modal.editTitle", dict) : tr("modal.addTitle", dict)
      }
      submitLabel={submitLabel}
      isProcessing={loading}
      onSubmit={handleSubmit(onSubmit)}
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
            <p className="mt-1 text-sm text-red-600">
              {trDynamic(errors.name.message, dict)}
            </p>
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
          <Textarea id="description" {...register("description")} rows={2} />
        </div>

        <div>
          <Label htmlFor="url">{tr("modal.url", dict)}</Label>
          <TextInput
            id="url"
            type="url"
            autoComplete="off"
            placeholder={tr("modal.urlPlaceholder", dict)}
            {...register("url")}
            color={errors.url ? "failure" : undefined}
          />
          {errors.url?.message && (
            <p className="mt-1 text-sm text-red-600">
              {trDynamic(errors.url.message, dict)}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="authMethod">{tr("modal.authMethod", dict)}</Label>
          <Select
            id="authMethod"
            {...register("authMethod")}
            onChange={(e) => {
              setValue("authMethod", e.target.value as AuthMethod, {
                shouldValidate: true,
              });
            }}
          >
            <option value="TOKEN">{tr("modal.authToken", dict)}</option>
            <option value="OAUTH">{tr("modal.authOAuth", dict)}</option>
          </Select>
        </div>

        {authMethod === "TOKEN" && (
          <div>
            <Label htmlFor="token">{tr("modal.token", dict)}</Label>
            <TextInput
              id="token"
              type="password"
              autoComplete="new-password"
              placeholder={
                editingSource
                  ? tr("modal.tokenPlaceholderEdit", dict)
                  : undefined
              }
              {...register("token")}
              color={errors.token ? "failure" : undefined}
            />
            {errors.token?.message && (
              <p className="mt-1 text-sm text-red-600">
                {trDynamic(errors.token.message, dict)}
              </p>
            )}
            {!errors.token?.message && editingSource && (
              <p className="mt-1 text-sm text-gray-500">
                {tr("modal.tokenHint", dict)}
              </p>
            )}
          </div>
        )}

        {authMethod === "OAUTH" && (
          <>
            <div>
              <Label htmlFor="clientId">{tr("modal.clientId", dict)}</Label>
              <TextInput
                id="clientId"
                {...register("clientId")}
                color={errors.clientId ? "failure" : undefined}
              />
              {errors.clientId?.message && (
                <p className="mt-1 text-sm text-red-600">
                  {trDynamic(errors.clientId.message, dict)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="clientSecret">
                {tr("modal.clientSecret", dict)}
              </Label>
              <TextInput
                id="clientSecret"
                type="password"
                autoComplete="new-password"
                placeholder={
                  editingSource
                    ? tr("modal.secretPlaceholderEdit", dict)
                    : undefined
                }
                {...register("clientSecret")}
                color={errors.clientSecret ? "failure" : undefined}
              />
              {errors.clientSecret?.message && (
                <p className="mt-1 text-sm text-red-600">
                  {trDynamic(errors.clientSecret.message, dict)}
                </p>
              )}
              {!errors.clientSecret?.message && editingSource && (
                <p className="mt-1 text-sm text-gray-500">
                  {tr("modal.secretHint", dict)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="tokenUrl">{tr("modal.tokenUrl", dict)}</Label>
              <TextInput
                id="tokenUrl"
                type="url"
                placeholder="https://auth.example.com/oauth/token"
                {...register("tokenUrl")}
                color={errors.tokenUrl ? "failure" : undefined}
              />
              {errors.tokenUrl?.message && (
                <p className="mt-1 text-sm text-red-600">
                  {trDynamic(errors.tokenUrl.message, dict)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="scope">{tr("modal.scope", dict)}</Label>
              <TextInput
                id="scope"
                placeholder={tr("modal.scopePlaceholder", dict)}
                {...register("scope")}
              />
              <p className="mt-1 text-sm text-gray-500">
                {tr("modal.scopeHint", dict)}
              </p>
            </div>

            <div>
              <Label htmlFor="audience">{tr("modal.audience", dict)}</Label>
              <TextInput
                id="audience"
                placeholder={tr("modal.audiencePlaceholder", dict)}
                {...register("audience")}
              />
              <p className="mt-1 text-sm text-gray-500">
                {tr("modal.audienceHint", dict)}
              </p>
            </div>
          </>
        )}

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
