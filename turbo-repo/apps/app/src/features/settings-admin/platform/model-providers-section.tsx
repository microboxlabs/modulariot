"use client";

import { useState, type ReactNode } from "react";
import { Badge, Button, Spinner } from "flowbite-react";
import { HiOutlineChip, HiPlus } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import ModelProviderEditor from "./model-provider-editor";
import { useModelProviders } from "./use-model-providers";
import type { ModelProviderAdmin, SetModelProvider } from "./platform.types";

interface ModelProvidersSectionProps {
  readonly dict: I18nRecord;
}

function formatPrice(value: number | null): string {
  return value == null ? "—" : `$${value}`;
}

/**
 * The AI providers the assistant may call, their keys and priced models.
 * Every organization can use every enabled model and is charged per token
 * at these prices.
 */
export default function ModelProvidersSection({
  dict,
}: ModelProvidersSectionProps) {
  const { providers, isLoading, error, save, remove } = useModelProviders();
  // null: no editor. "new": adding. Otherwise the provider being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleSave = async (provider: string, value: SetModelProvider) => {
    try {
      await save(provider, value);
      toast.success(tr("toast.saved", dict, { provider }));
      setEditing(null);
      return true;
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : tr("saveError", dict)
      );
      return false;
    }
  };

  const handleRemove = async (provider: string) => {
    try {
      await remove(provider);
      toast.success(tr("toast.removed", dict, { provider }));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : tr("saveError", dict)
      );
    } finally {
      setConfirming(null);
    }
  };

  function renderProvider(p: ModelProviderAdmin): ReactNode {
    if (editing === p.provider) {
      return (
        <ModelProviderEditor
          key={p.provider}
          dict={dict}
          existing={p}
          taken={[]}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      );
    }
    return (
      <li
        key={p.provider}
        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {p.provider}
          </span>
          <Badge color={p.enabled ? "success" : "gray"}>
            {p.enabled ? tr("statusEnabled", dict) : tr("statusDisabled", dict)}
          </Badge>
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {tr("keyPreview", dict, { preview: p.keyPreview })}
          </span>
          {p.baseUrl && (
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              {p.baseUrl}
            </span>
          )}
          <span className="ml-auto flex gap-2">
            <Button
              size="xs"
              color="light"
              onClick={() => setEditing(p.provider)}
            >
              {tr("edit", dict)}
            </Button>
            {confirming === p.provider ? (
              <Button
                size="xs"
                color="failure"
                onClick={() => void handleRemove(p.provider)}
              >
                {tr("removeConfirm", dict)}
              </Button>
            ) : (
              <Button
                size="xs"
                color="light"
                onClick={() => setConfirming(p.provider)}
              >
                {tr("remove", dict)}
              </Button>
            )}
          </span>
        </div>
        {p.models.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("noModels", dict)}
          </p>
        ) : (
          <table className="mt-2 w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-1 font-medium">
                  {tr("columns.model", dict)}
                </th>
                <th className="py-1 font-medium">
                  {tr("columns.input", dict)}
                </th>
                <th className="py-1 font-medium">
                  {tr("columns.output", dict)}
                </th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {p.models.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-gray-100 dark:border-gray-700"
                >
                  <td className="py-1 font-mono">{m.id}</td>
                  <td className="py-1">{formatPrice(m.inputPerMtok)}</td>
                  <td className="py-1">{formatPrice(m.outputPerMtok)}</td>
                  <td className="py-1 text-right">
                    {m.default && (
                      <Badge color="info">{tr("defaultBadge", dict)}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </li>
    );
  }

  function renderBody(): ReactNode {
    if (isLoading) return <Spinner size="sm" />;
    if (error) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-3">
        {providers.length === 0 && editing !== "new" && (
          <li className="text-sm text-gray-500 dark:text-gray-400">
            {tr("empty", dict)}
          </li>
        )}
        {providers.map(renderProvider)}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <HiOutlineChip className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tr("title", dict)}
          </h3>
          {editing === null && (
            <Button
              size="xs"
              color="blue"
              className="ml-auto"
              onClick={() => setEditing("new")}
            >
              <HiPlus className="mr-1 h-3.5 w-3.5" />
              {tr("add", dict)}
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("description", dict)}
        </p>
        <div className="mt-3">{renderBody()}</div>
      </div>

      {editing === "new" && (
        <ModelProviderEditor
          dict={dict}
          taken={providers.map((p) => p.provider)}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
