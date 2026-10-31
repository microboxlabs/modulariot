"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button, Spinner } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import { toast } from "sonner";
import { fetchCredentials } from "@/features/credentials/credentials-data-service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
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
  createChannelConnection,
  useConnectionChannel,
} from "./conversations-api";
import type {
  ConnectionChannel,
  ChannelConnection,
} from "./conversations-types";

/** The channel's contract as the integrations form shows a template: read-only, POST, the fields it maps. */
function contractTemplate(
  channel: ConnectionChannel,
  key: string,
  name: string
): IntegrationTemplate {
  return {
    id: key,
    name,
    providerType: "CUSTOM_HTTP",
    operationName: channel.operation,
    method: "POST",
    path: "",
    requestSchema: channel.requestSchema,
    responseSchema: {},
  };
}

const TEST_ROLES = new Set(["OWNER", "ADMIN", "PLATFORM_OWNER"]);

function ConnectionRow({
  connection,
  orgSlug,
  canTest,
  d,
}: Readonly<{
  connection: ChannelConnection;
  orgSlug: string | null;
  canTest: boolean;
  d: I18nRecord;
}>) {
  const [testing, setTesting] = useState(false);
  const test = async () => {
    if (!orgSlug) return;
    setTesting(true);
    try {
      const result = await testConnection(orgSlug, connection.id);
      if (result.success) toast.success(tr("channelTestOk", d));
      else toast.error(result.message ?? tr("channelTestFailed", d));
    } catch {
      toast.error(tr("channelTestFailed", d));
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
          {connection.host}
        </p>
      </div>
      {canTest && (
        <Button size="xs" color="light" onClick={test} disabled={testing}>
          {testing ? <Spinner size="xs" /> : tr("channelTest", d)}
        </Button>
      )}
    </li>
  );
}

/** Comunicaciones › Webhook, Slack or Teams: the body each connection receives and the organization's connections. */
export default function ConnectionChannelPanel({
  channelKey,
  d,
  connectionsDict,
  lang,
  canMaintain,
}: Readonly<{
  channelKey: string;
  d: I18nRecord;
  connectionsDict: I18nRecord;
  lang: string;
  canMaintain: boolean;
}>) {
  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;
  // The integrations test endpoint is for Owners and Admins.
  const canTest = TEST_ROLES.has(activeOrg?.role ?? "");
  const { data: channel, error } = useConnectionChannel(channelKey);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: credentials } = useSWR(
    creating && orgSlug ? ["channel-credentials", orgSlug] : null,
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
  const name = trDynamic(`channel_${channelKey}`, d);

  return (
    <div className="flex flex-col gap-4">
      <ChannelHeader channelKey={channelKey} d={d} />
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {tr("channelConnections", d)}
          </h3>
          <div className="flex items-center gap-2">
            <Link
              href={`/${lang}/users/settings/connections`}
              className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              {tr("channelManage", d)}
            </Link>
            {canMaintain && (
              <Button size="xs" color="blue" onClick={() => setCreating(true)}>
                <HiPlus className="mr-1 h-3.5 w-3.5" />
                {tr("channelNewConnection", d)}
              </Button>
            )}
          </div>
        </header>
        {channel.connections.length === 0 ? (
          <p className={`px-4 py-4 text-sm ${MUTED}`}>
            {tr("channelEmpty", d)}
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {channel.connections.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                orgSlug={orgSlug}
                canTest={canTest}
                d={d}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {tr("channelContract", d)}
        </h3>
        <p className={`mt-1 text-sm ${MUTED}`}>
          {tr("channelContractHint", d)}
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
        template={contractTemplate(channel, channelKey, name)}
        credentials={credentials ?? []}
        onClose={() => setCreating(false)}
        saving={saving}
        dict={connectionsDict}
        onSave={async (create) => {
          if (!create) return;
          setSaving(true);
          try {
            await createChannelConnection(channelKey, {
              name: create.name,
              baseUrl: create.baseUrl,
              credentialProfileId: create.credentialProfileId,
            });
            toast.success(tr("channelCreated", d));
            setCreating(false);
          } catch (cause) {
            toast.error(tr("channelCreateFailed", d));
            // The form stays open with what was typed and shows the error.
            throw cause;
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
