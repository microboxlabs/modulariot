"use client";

import { Badge, Button, Spinner } from "flowbite-react";
import { useState, type ReactNode } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgWhatsApp } from "./use-org-whatsapp";
import { WhatsAppConnectionModal } from "./whatsapp-connection-modal";
import { DEFAULT_GRAPH_VERSION } from "./whatsapp.types";
import type { IntegrationConnection, WhatsAppFormData } from "./whatsapp.types";

interface WhatsAppChannelCardProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

/**
 * Settings card for the org's WhatsApp channel. When no connection exists it offers a
 * Configure action (create); once configured it shows status, a live Test, and an Edit
 * action (update config / rotate the token).
 */
export default function WhatsAppChannelCard({
  orgSlug,
  dict,
}: WhatsAppChannelCardProps) {
  const waDict = (dict?.whatsappChannel as I18nRecord) ?? {};
  const { connection, isLoading, error, actionLoading, create, update, test } =
    useOrgWhatsApp(orgSlug);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  function openModal(mode: "create" | "edit") {
    setSubmitError(null);
    setModalMode(mode);
  }

  async function handleCreate(form: WhatsAppFormData) {
    setSubmitError(null);
    try {
      await create(form);
      setModalMode(null);
      toast.success(tr("toast.created", waDict));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err : new Error(tr("toast.error", waDict)),
      );
    }
  }

  async function handleUpdate(form: WhatsAppFormData) {
    if (!connection) return;
    setSubmitError(null);
    try {
      await update(connection.id, form);
      setModalMode(null);
      toast.success(tr("toast.updated", waDict));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err : new Error(tr("toast.error", waDict)),
      );
    }
  }

  async function handleTest() {
    if (!connection) return;
    try {
      const result = await test(connection.id);
      if (result.success) {
        toast.success(result.message || tr("toast.testSuccess", waDict));
      } else {
        toast.error(result.message || tr("toast.testFailed", waDict));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tr("toast.error", waDict),
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
          {tr("loadError", waDict)}
        </p>
      );
    }
    if (connection) {
      return (
        <ConfiguredRow
          connection={connection}
          dict={waDict}
          busy={actionLoading}
          onTest={handleTest}
          onEdit={() => openModal("edit")}
        />
      );
    }
    return (
      <Button
        size="xs"
        color="green"
        onClick={() => openModal("create")}
        disabled={!orgSlug}
      >
        {tr("configureButton", waDict)}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FaWhatsapp className="h-5 w-5 text-green-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tr("title", waDict)}
          </h3>
        </div>
        {connection && <StatusBadge status={connection.status} dict={waDict} />}
      </div>

      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", waDict)}
      </p>

      <div className="mt-3">{renderBody()}</div>

      <WhatsAppConnectionModal
        show={modalMode !== null}
        mode={modalMode ?? "create"}
        initial={
          modalMode === "edit" && connection ? connectionToForm(connection) : null
        }
        onClose={() => setModalMode(null)}
        onSubmit={modalMode === "edit" ? handleUpdate : handleCreate}
        loading={actionLoading}
        error={submitError}
        dict={waDict}
      />
    </div>
  );
}

interface ConfiguredRowProps {
  readonly connection: IntegrationConnection;
  readonly dict: I18nRecord;
  readonly busy: boolean;
  readonly onTest: () => void;
  readonly onEdit: () => void;
}

function ConfiguredRow({ connection, dict, busy, onTest, onEdit }: ConfiguredRowProps) {
  const rawPhone = connection.metadata?.phone_number_id;
  const phone = typeof rawPhone === "string" ? rawPhone : "—";
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-medium">{tr("phoneLabel", dict)}:</span> {phone}
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

function connectionToForm(connection: IntegrationConnection): WhatsAppFormData {
  const meta = connection.metadata ?? {};
  const str = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;
  return {
    name: connection.name,
    phoneNumberId: str(meta.phone_number_id),
    wabaId: str(meta.waba_id),
    graphVersion: str(meta.graph_version, DEFAULT_GRAPH_VERSION),
    baseUrl: connection.baseUrl,
    token: "",
  };
}

interface StatusBadgeProps {
  readonly status: IntegrationConnection["status"];
  readonly dict: I18nRecord;
}

function StatusBadge({ status, dict }: StatusBadgeProps) {
  const map: Record<
    IntegrationConnection["status"],
    { color: "success" | "gray" | "failure"; key: string }
  > = {
    ACTIVE: { color: "success", key: "status.active" },
    DRAFT: { color: "gray", key: "status.draft" },
    INACTIVE: { color: "gray", key: "status.inactive" },
    TEST_FAILED: { color: "failure", key: "status.failed" },
  };
  const entry = map[status] ?? map.DRAFT;
  return <Badge color={entry.color}>{tr(entry.key, dict)}</Badge>;
}
