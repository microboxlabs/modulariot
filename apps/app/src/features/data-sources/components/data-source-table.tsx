"use client";

import { Button, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "flowbite-react";
import { HiPencil, HiTrash, HiPlay } from "react-icons/hi";
import type { DataSourceListItem } from "../types";
import { ConnectionTestBadge } from "./connection-test-badge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface DataSourceTableProps {
  dataSources: DataSourceListItem[];
  onEdit: (ds: DataSourceListItem) => void;
  onDelete: (ds: DataSourceListItem) => void;
  onTest: (ds: DataSourceListItem) => void;
  loading?: boolean;
  dict: I18nRecord;
}

export function DataSourceTable({
  dataSources,
  onEdit,
  onDelete,
  onTest,
  loading,
  dict,
}: DataSourceTableProps) {
  if (dataSources.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">
          {tr("table.empty", dict)}
        </p>
      </div>
    );
  }

  return (
    <Table hoverable>
      <TableHead>
        <TableHeadCell>{tr("table.name", dict)}</TableHeadCell>
        <TableHeadCell>{tr("table.type", dict)}</TableHeadCell>
        <TableHeadCell>{tr("table.url", dict)}</TableHeadCell>
        <TableHeadCell>{tr("table.status", dict)}</TableHeadCell>
        <TableHeadCell>{tr("table.actions", dict)}</TableHeadCell>
      </TableHead>
      <TableBody className="divide-y">
        {dataSources.map((ds) => (
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
              <div className="flex gap-2">
                <Button
                  size="xs"
                  color="light"
                  onClick={() => onTest(ds)}
                  disabled={loading}
                  title={tr("table.test", dict)}
                >
                  <HiPlay className="h-4 w-4" />
                </Button>
                <Button
                  size="xs"
                  color="light"
                  onClick={() => onEdit(ds)}
                  disabled={loading}
                  title={tr("table.edit", dict)}
                >
                  <HiPencil className="h-4 w-4" />
                </Button>
                <Button
                  size="xs"
                  color="failure"
                  onClick={() => onDelete(ds)}
                  disabled={loading}
                  title={tr("table.delete", dict)}
                >
                  <HiTrash className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
