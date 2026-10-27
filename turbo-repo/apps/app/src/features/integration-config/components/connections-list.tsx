"use client";

import { Badge, DropdownItem, Spinner } from "flowbite-react";
import { HiOutlineDatabase, HiPencil, HiPlay, HiTrash } from "react-icons/hi";
import { BrandLogo } from "@/features/common/components/brand-logo";
import CatalogTable from "@/features/common/components/catalog-table";
import type { CatalogLayout } from "@/features/common/components/layout-toggle";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import {
  connectionMark,
  connectionState,
  connectionTypeName,
} from "../connection-catalog";
import type {
  IntegrationConnection,
  IntegrationTemplate,
} from "../integration-config.types";
import {
  CARD,
  CARD_BUTTON,
  EmptyRow,
  RowMenu,
  SUBLINE,
} from "./integration-row";

interface ConnectionsListProps {
  readonly connections: readonly IntegrationConnection[];
  /** Resolve each connection's type name and credential label. */
  readonly templates: readonly IntegrationTemplate[];
  readonly credentials: readonly CredentialListItem[];
  readonly onOpen: (connection: IntegrationConnection) => void;
  readonly onTest: (connection: IntegrationConnection) => void;
  readonly onDelete: (connection: IntegrationConnection) => void;
  /** Pick the functions a PostgREST connection exposes to dashboards. */
  readonly onFunctions: (connection: IntegrationConnection) => void;
  /** Id of the connection currently being exercised, if any. */
  readonly testing: string | null;
  readonly emptyMessage: string;
  readonly layout: CatalogLayout;
  readonly dict: I18nRecord;
}

/**
 * Connections as cards or as a table, like Settings › Credentials. Clicking a
 * connection opens it; the kebab tests, edits or deletes it without opening.
 */
export function ConnectionsList({
  connections,
  templates,
  credentials,
  onOpen,
  onTest,
  onDelete,
  onFunctions,
  testing,
  emptyMessage,
  layout,
  dict,
}: Readonly<ConnectionsListProps>) {
  if (connections.length === 0) {
    return <EmptyRow message={emptyMessage} />;
  }

  const items = connections.map((connection) => ({
    connection,
    typeName: connectionTypeName(connection, templates),
    credentialName:
      credentials.find(
        (credential) => credential.id === connection.credentialProfileId
      )?.name ?? null,
    actions: {
      onOpen: () => onOpen(connection),
      onTest: () => onTest(connection),
      onDelete: () => onDelete(connection),
      onFunctions:
        connection.providerType === "POSTGREST"
          ? () => onFunctions(connection)
          : undefined,
    },
    testing: testing === connection.id,
  }));

  if (layout === "list") {
    return (
      <CatalogTable
        columns={[
          tr("list.colConnection", dict),
          tr("list.colType", dict),
          tr("list.colStatus", dict),
          tr("list.colCredential", dict),
          "",
        ]}
      >
        {items.map((item) => (
          <ConnectionRow key={item.connection.id} {...item} dict={dict} />
        ))}
      </CatalogTable>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <ConnectionCard key={item.connection.id} {...item} dict={dict} />
      ))}
    </div>
  );
}

interface ConnectionActions {
  readonly onOpen: () => void;
  readonly onTest: () => void;
  readonly onDelete: () => void;
  readonly onFunctions?: () => void;
}

interface ConnectionItemProps {
  readonly connection: IntegrationConnection;
  readonly typeName: string;
  readonly credentialName: string | null;
  readonly actions: ConnectionActions;
  readonly testing: boolean;
  readonly dict: I18nRecord;
}

function ConnectionCard({
  connection,
  typeName,
  credentialName,
  actions,
  testing,
  dict,
}: ConnectionItemProps) {
  return (
    <div className={CARD}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <ConnectionLogo connection={connection} typeName={typeName} size={40} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={actions.onOpen}
            className={CARD_BUTTON}
          >
            {connection.name}
          </button>
          <div className={SUBLINE}>{typeName}</div>
        </div>
        <div className="relative shrink-0">
          <ConnectionMenu actions={actions} testing={testing} dict={dict} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
        <StatusBadge connection={connection} dict={dict} />
        <span className={SUBLINE}>{testLine(connection, dict)}</span>
      </div>
      <p className="mt-2 truncate px-4 font-mono text-xs text-gray-600 dark:text-gray-300">
        {connection.baseUrl}
      </p>
      <div className="min-h-3 flex-1" />
      <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
        <span className="shrink-0">{tr("connections.credential", dict)}</span>
        <span className="truncate text-gray-700 dark:text-gray-300">
          {credentialName ?? tr("connections.noCredential", dict)}
        </span>
      </div>
    </div>
  );
}

function ConnectionRow({
  connection,
  typeName,
  credentialName,
  actions,
  testing,
  dict,
}: ConnectionItemProps) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
      <td className="max-w-96 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <ConnectionLogo
            connection={connection}
            typeName={typeName}
            size={24}
          />
          <div className="min-w-0">
            <button
              type="button"
              onClick={actions.onOpen}
              className="cursor-pointer truncate text-left text-sm font-medium text-gray-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-400"
            >
              {connection.name}
            </button>
            <div className={`${SUBLINE} font-mono`}>{connection.baseUrl}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">{typeName}</td>
      <td className="px-4 py-2.5">
        <StatusBadge connection={connection} dict={dict} />
        <div className={`${SUBLINE} mt-1`}>{testLine(connection, dict)}</div>
      </td>
      <td className="max-w-48 truncate px-4 py-2.5">
        {credentialName ?? tr("connections.noCredential", dict)}
      </td>
      <td className="px-2 py-2.5 text-right">
        <ConnectionMenu actions={actions} testing={testing} dict={dict} />
      </td>
    </tr>
  );
}

function ConnectionLogo({
  connection,
  typeName,
  size,
}: Readonly<{
  connection: IntegrationConnection;
  typeName: string;
  size: number;
}>) {
  return (
    <BrandLogo
      {...connectionMark(connection, typeName)}
      alt={typeName}
      size={size}
    />
  );
}

function ConnectionMenu({
  actions,
  testing,
  dict,
}: Readonly<{
  actions: ConnectionActions;
  testing: boolean;
  dict: I18nRecord;
}>) {
  if (testing) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center">
        <Spinner size="sm" aria-label={tr("connections.test", dict)} />
      </span>
    );
  }
  return (
    <RowMenu dict={dict}>
      <DropdownItem icon={HiPencil} onClick={actions.onOpen}>
        {tr("common.edit", dict)}
      </DropdownItem>
      <DropdownItem icon={HiPlay} onClick={actions.onTest}>
        {tr("connections.test", dict)}
      </DropdownItem>
      {actions.onFunctions && (
        <DropdownItem icon={HiOutlineDatabase} onClick={actions.onFunctions}>
          {tr("postgrest.functions", dict)}
        </DropdownItem>
      )}
      <DropdownItem icon={HiTrash} onClick={actions.onDelete}>
        {tr("common.delete", dict)}
      </DropdownItem>
    </RowMenu>
  );
}

const STATE_TONE = {
  active: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  failed: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
} as const;

/** Same colours as the credential test badge: green connected, red failed, gray draft. */
function StatusBadge({
  connection,
  dict,
}: Readonly<{ connection: IntegrationConnection; dict: I18nRecord }>) {
  const state = connectionState(connection);
  return (
    <Badge color="gray" size="xs" className={`w-fit ${STATE_TONE[state]}`}>
      {trDynamic(`status.${state}`, dict)}
    </Badge>
  );
}

/** When it was last exercised — one nobody ever tested says so plainly. */
function testLine(connection: IntegrationConnection, dict: I18nRecord): string {
  if (!connection.lastTestedAt) return tr("connections.neverTested", dict);
  return tr("connections.testedOn", dict, {
    date: new Date(connection.lastTestedAt).toLocaleDateString(),
  });
}
