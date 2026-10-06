"use client";

import { Button, Spinner } from "flowbite-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ChannelStatusBadge } from "./channel-status-badge";
import type {
  ChannelCreate,
  ChannelUpdate,
  IntegrationConnection,
} from "./channel.types";
import { useOrgChannel } from "./use-org-channel";

/** What the card hands to the channel's form modal. */
export interface ChannelModalProps<F> {
  readonly show: boolean;
  readonly mode: "create" | "edit";
  readonly initial: F | null;
  readonly onClose: () => void;
  readonly onSubmit: (form: F) => void;
  readonly loading: boolean;
  readonly error: Error | null;
}

interface ChannelCardProps<F> {
  readonly orgSlug: string | null;
  readonly provider: string;
  /** The channel's dictionary: title, description, loadError, buttons, `status.*`, `toast.*`. */
  readonly dict: I18nRecord;
  readonly icon: ReactNode;
  readonly toCreate: (form: F) => ChannelCreate;
  readonly toUpdate: (form: F) => ChannelUpdate;
  readonly toForm: (connection: IntegrationConnection) => F;
  /** One line about the configured connection, under its name. */
  readonly detail: (connection: IntegrationConnection) => ReactNode;
  /** Extra badges next to the status. */
  readonly badges?: (connection: IntegrationConnection) => ReactNode;
  readonly renderModal: (props: ChannelModalProps<F>) => ReactNode;
}

/**
 * An organization's connection for one channel provider: Configure when there is none;
 * otherwise its status, Edit and a live Test.
 */
export function ChannelCard<F>({
  orgSlug,
  provider,
  dict,
  icon,
  toCreate,
  toUpdate,
  toForm,
  detail,
  badges,
  renderModal,
}: Readonly<ChannelCardProps<F>>) {
  const { connection, isLoading, error, actionLoading, create, update, test } =
    useOrgChannel(orgSlug, provider);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  function openModal(mode: "create" | "edit") {
    setSubmitError(null);
    setModalMode(mode);
  }

  async function submit(action: () => Promise<unknown>, doneKey: string) {
    setSubmitError(null);
    try {
      await action();
      setModalMode(null);
      toast.success(trDynamic(doneKey, dict));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err : new Error(tr("toast.error", dict))
      );
    }
  }

  async function handleTest() {
    if (!connection) return;
    try {
      const result = await test(connection.id);
      if (result.success) {
        toast.success(result.message || tr("toast.testSuccess", dict));
      } else {
        toast.error(result.message || tr("toast.testFailed", dict));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("toast.error", dict));
    }
  }

  const onSubmit = (form: F) => {
    if (modalMode === "edit" && connection) {
      void submit(() => update(connection.id, toUpdate(form)), "toast.updated");
    } else {
      void submit(() => create(toCreate(form)), "toast.created");
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tr("title", dict)}
          </h3>
        </div>
        {connection && (
          <div className="flex items-center gap-2">
            {badges?.(connection)}
            <ChannelStatusBadge status={connection.status} dict={dict} />
          </div>
        )}
      </div>

      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      <div className="mt-3">
        <CardBody
          orgSlug={orgSlug}
          connection={connection}
          isLoading={isLoading}
          failed={error !== null}
          busy={actionLoading}
          dict={dict}
          detail={detail}
          onConfigure={() => openModal("create")}
          onEdit={() => openModal("edit")}
          onTest={handleTest}
        />
      </div>

      {renderModal({
        show: modalMode !== null,
        mode: modalMode ?? "create",
        initial: modalMode === "edit" && connection ? toForm(connection) : null,
        onClose: () => setModalMode(null),
        onSubmit,
        loading: actionLoading,
        error: submitError,
      })}
    </div>
  );
}

interface CardBodyProps {
  readonly orgSlug: string | null;
  readonly connection: IntegrationConnection | null;
  readonly isLoading: boolean;
  readonly failed: boolean;
  readonly busy: boolean;
  readonly dict: I18nRecord;
  readonly detail: (connection: IntegrationConnection) => ReactNode;
  readonly onConfigure: () => void;
  readonly onEdit: () => void;
  readonly onTest: () => void;
}

function CardBody({
  orgSlug,
  connection,
  isLoading,
  failed,
  busy,
  dict,
  detail,
  onConfigure,
  onEdit,
  onTest,
}: CardBodyProps) {
  if (isLoading) {
    return <Spinner size="sm" />;
  }
  if (failed) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {tr("loadError", dict)}
      </p>
    );
  }
  if (!connection) {
    return (
      <Button size="xs" color="blue" onClick={onConfigure} disabled={!orgSlug}>
        {tr("configureButton", dict)}
      </Button>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {connection.name}
        </div>
        <div>{detail(connection)}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="xs" color="light" disabled={busy} onClick={onEdit}>
          {tr("editButton", dict)}
        </Button>
        <Button size="xs" color="light" disabled={busy} onClick={onTest}>
          {busy ? <Spinner size="sm" /> : tr("testButton", dict)}
        </Button>
      </div>
    </div>
  );
}
