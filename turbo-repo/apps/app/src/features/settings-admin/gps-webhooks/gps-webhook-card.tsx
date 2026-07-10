"use client";

import { Badge, Button, Spinner } from "flowbite-react";
import { useState, type ReactNode } from "react";
import { HiOutlineRss } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { GpsWebhookModal } from "./gps-webhook-modal";
import { useOrgGpsWebhooks } from "./use-org-gps-webhooks";
import {
  subscriptionToForm,
  summarizeFilter,
  type GpsWebhookFormData,
  type GpsWebhookSubscription,
} from "./gps-webhook.types";

interface GpsWebhookCardProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

/**
 * Settings card for tenant GPS webhook subscriptions (outbound position fan-out).
 * Supports multiple subscriptions per org.
 */
export default function GpsWebhookCard({ orgSlug, dict }: GpsWebhookCardProps) {
  const whDict = (dict?.gpsWebhooks as I18nRecord) ?? {};
  const {
    subscriptions,
    isLoading,
    error,
    actionLoading,
    create,
    update,
    remove,
    test,
  } = useOrgGpsWebhooks(orgSlug);

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<GpsWebhookSubscription | null>(null);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  function openCreate() {
    setSubmitError(null);
    setEditing(null);
    setModalMode("create");
  }

  function openEdit(sub: GpsWebhookSubscription) {
    setSubmitError(null);
    setEditing(sub);
    setModalMode("edit");
  }

  async function handleCreate(form: GpsWebhookFormData) {
    setSubmitError(null);
    try {
      await create(form);
      setModalMode(null);
      toast.success(tr("toast.created", whDict));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err : new Error(tr("toast.error", whDict)),
      );
    }
  }

  async function handleUpdate(form: GpsWebhookFormData) {
    if (!editing) return;
    setSubmitError(null);
    try {
      await update(editing.id, form);
      setModalMode(null);
      setEditing(null);
      toast.success(tr("toast.updated", whDict));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err : new Error(tr("toast.error", whDict)),
      );
    }
  }

  async function handleTest(sub: GpsWebhookSubscription) {
    try {
      const result = await test(sub.id);
      if (result.success) {
        toast.success(result.message || tr("toast.testSuccess", whDict));
      } else {
        toast.error(result.message || tr("toast.testFailed", whDict));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tr("toast.error", whDict),
      );
    }
  }

  async function handleDelete(sub: GpsWebhookSubscription) {
    try {
      await remove(sub.id);
      toast.success(tr("toast.deleted", whDict));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tr("toast.error", whDict),
      );
    }
  }

  function renderBody(): ReactNode {
    if (isLoading) {
      return <Spinner size="sm" />;
    }
    if (error) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("loadError", whDict)}
        </p>
      );
    }
    if (subscriptions.length === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("empty", whDict)}
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-3">
        {subscriptions.map((sub) => (
          <SubscriptionRow
            key={sub.id}
            subscription={sub}
            dict={whDict}
            busy={actionLoading}
            onEdit={() => openEdit(sub)}
            onTest={() => handleTest(sub)}
            onDelete={() => handleDelete(sub)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <HiOutlineRss className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tr("title", whDict)}
          </h3>
        </div>
        <Button
          size="xs"
          color="indigo"
          onClick={openCreate}
          disabled={!orgSlug || actionLoading}
        >
          {tr("addButton", whDict)}
        </Button>
      </div>

      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", whDict)}
      </p>

      <div className="mt-3">{renderBody()}</div>

      <GpsWebhookModal
        show={modalMode !== null}
        mode={modalMode ?? "create"}
        initial={
          modalMode === "edit" && editing
            ? subscriptionToForm(editing)
            : null
        }
        onClose={() => {
          setModalMode(null);
          setEditing(null);
        }}
        onSubmit={modalMode === "edit" ? handleUpdate : handleCreate}
        loading={actionLoading}
        error={submitError}
        dict={whDict}
      />
    </div>
  );
}

interface SubscriptionRowProps {
  readonly subscription: GpsWebhookSubscription;
  readonly dict: I18nRecord;
  readonly busy: boolean;
  readonly onEdit: () => void;
  readonly onTest: () => void;
  readonly onDelete: () => void;
}

function SubscriptionRow({
  subscription,
  dict,
  busy,
  onEdit,
  onTest,
  onDelete,
}: SubscriptionRowProps) {
  let host = subscription.url;
  try {
    host = new URL(subscription.url).host;
  } catch {
    // keep raw url
  }

  const filterKey = summarizeFilter(subscription);
  const filterLabel =
    filterKey === "allVisible"
      ? tr("filter.allVisible", dict)
      : filterKey === "rules"
        ? tr("filter.rules", dict)
        : filterKey;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {subscription.name}
          </span>
          <Badge color={subscription.enabled ? "success" : "gray"}>
            {subscription.enabled
              ? tr("status.enabled", dict)
              : tr("status.disabled", dict)}
          </Badge>
        </div>
        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
          {host}
        </div>
        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">{tr("filterLabel", dict)}:</span>{" "}
          {filterLabel}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Button size="xs" color="light" disabled={busy} onClick={onEdit}>
          {tr("editButton", dict)}
        </Button>
        <Button size="xs" color="light" disabled={busy} onClick={onTest}>
          {busy ? <Spinner size="sm" /> : tr("testButton", dict)}
        </Button>
        <Button size="xs" color="failure" disabled={busy} onClick={onDelete}>
          {tr("deleteButton", dict)}
        </Button>
      </div>
    </li>
  );
}
