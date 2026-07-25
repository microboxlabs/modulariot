"use client";

import { Badge, DropdownItem, Spinner } from "flowbite-react";
import { HiOutlineLink, HiPencil, HiPlay, HiTrash } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import type {
  IntegrationConnection,
  IntegrationTemplate,
} from "../integration-config.types";
import {
  EmptyRow,
  ROW,
  ROW_BUTTON,
  RowIcon,
  RowMenu,
  SUBLINE,
} from "./integration-row";

interface ConnectionsListProps {
  readonly connections: readonly IntegrationConnection[];
  /** Resolve each row's template name and credential label. */
  readonly templates: readonly IntegrationTemplate[];
  readonly credentials: readonly CredentialListItem[];
  readonly onOpen: (connection: IntegrationConnection) => void;
  readonly onTest: (connection: IntegrationConnection) => void;
  readonly onDelete: (connection: IntegrationConnection) => void;
  /** Id of the connection currently being exercised, if any. */
  readonly testing: string | null;
  readonly emptyMessage: string;
  readonly dict: I18nRecord;
}

/**
 * List view for connections — the instances.
 *
 * Same row grammar as Settings › Credentials: identity on the left, state in the
 * middle, the credential it carries on the right, actions in the kebab.
 */
export function ConnectionsList({
  connections,
  templates,
  credentials,
  onOpen,
  onTest,
  onDelete,
  testing,
  emptyMessage,
  dict,
}: ConnectionsListProps) {
  if (connections.length === 0) {
    return <EmptyRow message={emptyMessage} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {connections.map((connection) => (
        <li key={connection.id}>
          <ConnectionRow
            connection={connection}
            templateName={
              templates.find(
                (template) => template.id === connection.templateId
              )?.name ?? connection.providerType
            }
            credentialName={
              credentials.find(
                (credential) => credential.id === connection.credentialProfileId
              )?.name ?? null
            }
            onOpen={() => onOpen(connection)}
            onTest={() => onTest(connection)}
            onDelete={() => onDelete(connection)}
            testing={testing === connection.id}
            dict={dict}
          />
        </li>
      ))}
    </ul>
  );
}

interface ConnectionRowProps {
  readonly connection: IntegrationConnection;
  readonly templateName: string;
  readonly credentialName: string | null;
  readonly onOpen: () => void;
  readonly onTest: () => void;
  readonly onDelete: () => void;
  readonly testing: boolean;
  readonly dict: I18nRecord;
}

function ConnectionRow({
  connection,
  templateName,
  credentialName,
  onOpen,
  onTest,
  onDelete,
  testing,
  dict,
}: ConnectionRowProps) {
  return (
    <div className={ROW}>
      <RowIcon>
        <HiOutlineLink className="h-5 w-5" />
      </RowIcon>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900 dark:text-white">
          <button type="button" onClick={onOpen} className={ROW_BUTTON}>
            {connection.name}
          </button>
        </div>
        <div className={SUBLINE}>
          {templateName}
          {" · "}
          <span className="font-mono">{connection.baseUrl}</span>
        </div>
      </div>

      <div className="hidden w-52 shrink-0 flex-col gap-1 sm:flex">
        <div className="flex items-center gap-2">
          <StatusBadge connection={connection} dict={dict} />
        </div>
        <div className={SUBLINE}>{testLine(connection, dict)}</div>
      </div>

      <div className="hidden w-40 shrink-0 text-right md:block">
        <div className="truncate text-sm text-gray-700 dark:text-gray-300">
          {credentialName ?? tr("connections.noCredential", dict)}
        </div>
        <div className={SUBLINE}>{tr("connections.credential", dict)}</div>
      </div>

      <div className="relative shrink-0">
        {testing ? (
          <span className="flex h-8 w-8 items-center justify-center">
            <Spinner size="sm" aria-label={tr("connections.test", dict)} />
          </span>
        ) : (
          <RowMenu dict={dict}>
            <DropdownItem icon={HiPencil} onClick={onOpen}>
              {tr("common.edit", dict)}
            </DropdownItem>
            <DropdownItem icon={HiPlay} onClick={onTest}>
              {tr("connections.test", dict)}
            </DropdownItem>
            <DropdownItem icon={HiTrash} onClick={onDelete}>
              {tr("common.delete", dict)}
            </DropdownItem>
          </RowMenu>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  connection,
  dict,
}: Readonly<{ connection: IntegrationConnection; dict: I18nRecord }>) {
  if (connection.status === "ACTIVE" || connection.lastTestResult === true) {
    return <Badge color="success">{tr("status.active", dict)}</Badge>;
  }
  if (
    connection.status === "TEST_FAILED" ||
    connection.lastTestResult === false
  ) {
    return <Badge color="failure">{tr("status.failed", dict)}</Badge>;
  }
  return <Badge color="gray">{tr("status.draft", dict)}</Badge>;
}

/** When it was last exercised — one nobody ever tested says so plainly. */
function testLine(connection: IntegrationConnection, dict: I18nRecord): string {
  if (!connection.lastTestedAt) return tr("connections.neverTested", dict);
  return tr("connections.testedOn", dict, {
    date: new Date(connection.lastTestedAt).toLocaleDateString(),
  });
}
