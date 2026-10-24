"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button, Spinner } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import { toast } from "sonner";
import { fetchCredentials } from "@/features/credentials/credentials-data-service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ConnectionFormModal } from "@/features/integration-config/components/connection-form-modal";
import { testConnection } from "@/features/integration-config/integration-config-data-service";
import {
  schemaLeafPaths,
  type IntegrationTemplate,
} from "@/features/integration-config/integration-config.types";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { ChannelHeader } from "./channel-panel";
import {
  createWebhookConnection,
  useWebhookChannel,
} from "./conversations-api";
import type { WebhookChannel, WebhookConnection } from "./conversations-types";

/** The webhook contract as the integrations form shows a template: read-only, POST, the fields it maps. */
function contractTemplate(
  channel: WebhookChannel,
  name: string
): IntegrationTemplate {
  return {
    id: "webhook",
    name,
    providerType: "CUSTOM_HTTP",
    operationName: channel.operation,
    method: "POST",
    path: "",
    requestSchema: channel.requestSchema,
    responseSchema: {},
  };
}

function ConnectionRow({
  connection,
  orgSlug,
  d,
}: Readonly<{
  connection: WebhookConnection;
  orgSlug: string | null;
  d: I18nRecord;
}>) {
  const [testing, setTesting] = useState(false);
  const test = async () => {
    if (!orgSlug) return;
    setTesting(true);
    try {
      const result = await testConnection(orgSlug, connection.id);
      if (result.success) toast.success(tr("webhookTestOk", d));
      else toast.error(result.message ?? tr("webhookTestFailed", d));
    } catch {
      toast.error(tr("webhookTestFailed", d));
    } finally {
      setTesting(false);
    }
  };
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
          {connection.name}
        </p>
        <p className={`truncate font-mono text-xs ${MUTED}`}>
          {connection.baseUrl}
        </p>
      </div>
      <Button size="xs" color="light" onClick={test} disabled={testing}>
        {testing ? <Spinner size="xs" /> : tr("webhookTest", d)}
      </Button>
    </li>
  );
}

/** Comunicaciones › Webhook: the payload contract and the organization's connections that receive it. */
export default function WebhookPanel({
  d,
  connectionsDict,
  lang,
  canMaintain,
}: Readonly<{
  d: I18nRecord;
  connectionsDict: I18nRecord;
  lang: string;
  canMaintain: boolean;
}>) {
  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;
  const { data: channel, error } = useWebhookChannel();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: credentials } = useSWR(
    creating && orgSlug ? ["webhook-credentials", orgSlug] : null,
    () => fetchCredentials(orgSlug as string)
  );

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {tr("loadFailed", d)}
      </p>
    );
  }
  if (!channel) return <Spinner size="md" />;

  const fields = schemaLeafPaths(channel.requestSchema);
  const name = tr("channel_webhook", d);

  return (
    <div className="flex flex-col gap-4">
      <ChannelHeader channelKey="webhook" d={d} />
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {tr("webhookConnections", d)}
          </h3>
          <div className="flex items-center gap-2">
            <Link
              href={`/${lang}/users/settings/connections`}
              className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              {tr("webhookManage", d)}
            </Link>
            {canMaintain && (
              <Button size="xs" color="blue" onClick={() => setCreating(true)}>
                <HiPlus className="mr-1 h-3.5 w-3.5" />
                {tr("webhookNewConnection", d)}
              </Button>
            )}
          </div>
        </header>
        {channel.connections.length === 0 ? (
          <p className={`px-4 py-4 text-sm ${MUTED}`}>
            {tr("webhookEmpty", d)}
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {channel.connections.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                orgSlug={orgSlug}
                d={d}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {tr("webhookContract", d)}
        </h3>
        <p className={`mt-1 text-sm ${MUTED}`}>
          {tr("webhookContractHint", d)}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {fields.map((f) => (
            <li
              key={f}
              className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            >
              {f}
            </li>
          ))}
        </ul>
      </section>

      <ConnectionFormModal
        show={creating}
        connection={undefined}
        template={contractTemplate(channel, name)}
        credentials={credentials ?? []}
        onClose={() => setCreating(false)}
        saving={saving}
        dict={connectionsDict}
        onSave={async (create) => {
          if (!create) return;
          setSaving(true);
          try {
            await createWebhookConnection({
              name: create.name,
              baseUrl: create.baseUrl,
              credentialProfileId: create.credentialProfileId,
            });
            toast.success(tr("webhookCreated", d));
            setCreating(false);
          } catch {
            toast.error(tr("webhookCreateFailed", d));
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
