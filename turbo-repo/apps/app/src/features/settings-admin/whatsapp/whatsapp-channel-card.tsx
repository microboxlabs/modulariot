"use client";

import { Badge, Button, Spinner } from "flowbite-react";
import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgWhatsApp } from "./use-org-whatsapp";
import { WhatsAppConnectionModal } from "./whatsapp-connection-modal";
import type { IntegrationConnection, WhatsAppFormData } from "./whatsapp.types";

interface WhatsAppChannelCardProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

/**
 * Settings card for the org's WhatsApp channel. When no connection exists it
 * offers a Configure action (create); once configured it shows status + a live
 * Test. Edit/delete are deferred (the backend has no update/delete yet).
 */
export default function WhatsAppChannelCard({
  orgSlug,
  dict,
}: WhatsAppChannelCardProps) {
  const waDict = (dict?.whatsappChannel as I18nRecord) ?? {};
  const { connection, isLoading, actionLoading, create, test } =
    useOrgWhatsApp(orgSlug);
  const [showModal, setShowModal] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  async function handleCreate(form: WhatsAppFormData) {
    setSubmitError(null);
    try {
      await create(form);
      setShowModal(false);
      toast.success(tr("toast.created", waDict));
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

      <div className="mt-3">
        {isLoading ? (
          <Spinner size="sm" />
        ) : connection ? (
          <ConfiguredRow
            connection={connection}
            dict={waDict}
            testing={actionLoading}
            onTest={handleTest}
          />
        ) : (
          <Button
            size="xs"
            color="green"
            onClick={() => setShowModal(true)}
            disabled={!orgSlug}
          >
            {tr("configureButton", waDict)}
          </Button>
        )}
      </div>

      <WhatsAppConnectionModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
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
  readonly testing: boolean;
  readonly onTest: () => void;
}

function ConfiguredRow({ connection, dict, testing, onTest }: ConfiguredRowProps) {
  const phone = String(connection.metadata?.phone_number_id ?? "—");
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-medium">{tr("phoneLabel", dict)}:</span> {phone}
      </div>
      <Button size="xs" color="light" disabled={testing} onClick={onTest}>
        {testing ? <Spinner size="sm" /> : tr("testButton", dict)}
      </Button>
    </div>
  );
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
