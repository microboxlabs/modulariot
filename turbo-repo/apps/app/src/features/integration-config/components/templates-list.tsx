"use client";

import { DropdownItem } from "flowbite-react";
import { Code } from "flowbite-react-icons/outline";
import { HiPencil, HiTrash } from "react-icons/hi";
import { BrandLogo } from "@/features/common/components/brand-logo";
import CatalogTable from "@/features/common/components/catalog-table";
import type { CatalogLayout } from "@/features/common/components/layout-toggle";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  schemaLeafPaths,
  type IntegrationTemplate,
} from "../integration-config.types";
import {
  CARD,
  CARD_BUTTON,
  EmptyRow,
  RowMenu,
  SUBLINE,
} from "./integration-row";

interface TemplatesListProps {
  readonly templates: readonly IntegrationTemplate[];
  /** How many connections instance each template — its delete guard, made visible. */
  readonly instanceCount: (templateId: string) => number;
  readonly onOpen: (template: IntegrationTemplate) => void;
  readonly onDelete: (template: IntegrationTemplate) => void;
  readonly emptyMessage: string;
  readonly layout: CatalogLayout;
  readonly dict: I18nRecord;
}

/**
 * Templates — the types — as cards or as a table: the contract each forces (method,
 * path, fields to map) and how many connections already copied it.
 */
export function TemplatesList({
  templates,
  instanceCount,
  onOpen,
  onDelete,
  emptyMessage,
  layout,
  dict,
}: TemplatesListProps) {
  if (templates.length === 0) {
    return <EmptyRow message={emptyMessage} />;
  }

  const items = templates.map((template) => ({
    template,
    instances: instanceCount(template.id),
    fields: schemaLeafPaths(template.requestSchema).length,
    onOpen: () => onOpen(template),
    onDelete: () => onDelete(template),
  }));

  if (layout === "list") {
    return (
      <CatalogTable
        columns={[
          tr("list.colTemplate", dict),
          tr("list.colOperation", dict),
          tr("list.colFields", dict),
          tr("list.colConnections", dict),
          "",
        ]}
      >
        {items.map((item) => (
          <tr
            key={item.template.id}
            className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
          >
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <BrandLogo icon={Code} alt={item.template.providerType} />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={item.onOpen}
                    className="cursor-pointer truncate text-left text-sm font-medium text-gray-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-400"
                  >
                    {item.template.name}
                  </button>
                  <div className={SUBLINE}>{item.template.providerType}</div>
                </div>
              </div>
            </td>
            <td className="px-4 py-2.5 font-mono">
              {item.template.method} {item.template.path}
            </td>
            <td className="px-4 py-2.5">{item.fields}</td>
            <td className="px-4 py-2.5">{item.instances}</td>
            <td className="px-2 py-2.5 text-right">
              <TemplateMenu {...item} dict={dict} />
            </td>
          </tr>
        ))}
      </CatalogTable>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.template.id} className={CARD}>
          <div className="flex items-start gap-3 px-4 pt-4">
            <BrandLogo icon={Code} alt={item.template.providerType} size={40} />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={item.onOpen}
                className={CARD_BUTTON}
              >
                {item.template.name}
              </button>
              <div className={SUBLINE}>{item.template.providerType}</div>
            </div>
            <div className="relative shrink-0">
              <TemplateMenu {...item} dict={dict} />
            </div>
          </div>
          <p className="mt-3 truncate px-4 font-mono text-xs text-gray-600 dark:text-gray-300">
            {item.template.method} {item.template.path}
          </p>
          <div className="min-h-3 flex-1" />
          <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
            <span>
              {tr("templates.fields", dict, { count: String(item.fields) })}
            </span>
            <span>·</span>
            <span>
              {tr("templates.instanceCount", dict, {
                count: String(item.instances),
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateMenu({
  onOpen,
  onDelete,
  dict,
}: Readonly<{ onOpen: () => void; onDelete: () => void; dict: I18nRecord }>) {
  return (
    <RowMenu dict={dict}>
      <DropdownItem icon={HiPencil} onClick={onOpen}>
        {tr("common.edit", dict)}
      </DropdownItem>
      <DropdownItem icon={HiTrash} onClick={onDelete}>
        {tr("common.delete", dict)}
      </DropdownItem>
    </RowMenu>
  );
}
