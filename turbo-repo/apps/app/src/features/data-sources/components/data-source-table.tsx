"use client";

import { Badge, Button, TableCell, TableRow, ToggleSwitch } from "flowbite-react";
import { HiPencil, HiTrash, HiPlay } from "react-icons/hi";
import type { DataSourceListItem } from "../types";
import { ConnectionTestBadge } from "./connection-test-badge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import CustomTable from "@/features/common/components/custom-table/custom-table";

interface DataSourceTableProps {
  readonly dataSources: DataSourceListItem[];
  readonly onEdit: (ds: DataSourceListItem) => void;
  readonly onDelete: (ds: DataSourceListItem) => void;
  readonly onTest: (ds: DataSourceListItem) => void;
  readonly onToggleActive: (ds: DataSourceListItem) => void;
  readonly loading?: boolean;
  readonly dict: I18nRecord;
}

export function DataSourceTable({
  dataSources,
  onEdit,
  onDelete,
  onTest,
  onToggleActive,
  loading,
  dict,
}: DataSourceTableProps) {
  const header = [
    tr("table.name", dict),
    tr("table.type", dict),
    tr("table.auth", dict),
    tr("table.url", dict),
    tr("table.status", dict),
    tr("table.active", dict),
    tr("table.actions", dict),
  ];

  const content = dataSources.map((ds) => (
    <TableRow
      key={ds.id}
      className="bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <TableCell className="font-medium text-gray-900 whitespace-nowrap dark:text-white">
        <div>
          <div>{ds.name}</div>
          {ds.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {ds.description}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>{ds.type}</TableCell>
      <TableCell>
        <Badge color={ds.authMethod === "OAUTH" ? "purple" : "blue"} size="xs">
          {ds.authMethod === "OAUTH" ? "OAuth" : "Token"}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[200px] truncate text-xs">
        {ds.connectionConfig.url}
      </TableCell>
      <TableCell>
        <ConnectionTestBadge
          lastTestedAt={ds.lastTestedAt}
          lastTestResult={ds.lastTestResult}
          dict={dict}
        />
      </TableCell>
      <TableCell>
        <ToggleSwitch
          checked={ds.isActive}
          onChange={() => onToggleActive(ds)}
          disabled={loading}
          label={ds.isActive ? tr("table.active", dict) : tr("table.inactive", dict)}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="xs"
            color="light"
            onClick={() => onTest(ds)}
            disabled={loading}
            title={tr("table.test", dict)}
            aria-label={tr("table.test", dict)}
          >
            <HiPlay className="h-4 w-4" />
          </Button>
          <Button
            size="xs"
            color="light"
            onClick={() => onEdit(ds)}
            disabled={loading}
            title={tr("table.edit", dict)}
            aria-label={tr("table.edit", dict)}
          >
            <HiPencil className="h-4 w-4" />
          </Button>
          <Button
            size="xs"
            color="failure"
            onClick={() => onDelete(ds)}
            disabled={loading}
            title={tr("table.delete", dict)}
            aria-label={tr("table.delete", dict)}
          >
            <HiTrash className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  ));

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-900 dark:text-white h-full flex flex-col border-2 border-gray-200 dark:border-gray-700 rounded-lg">
      <CustomTable
        header={header}
        content={content}
        hoverable={true}
        no_data_message={tr("table.empty", dict)}
      />
    </div>
  );
}
