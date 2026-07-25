"use client";

import { Badge, DropdownItem } from "flowbite-react";
import { HiOutlineTemplate, HiPencil, HiTrash } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  schemaLeafPaths,
  type IntegrationTemplate,
} from "../integration-config.types";
import {
  EmptyRow,
  ROW,
  ROW_BUTTON,
  RowIcon,
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
  readonly dict: I18nRecord;
}

/**
 * List view for templates — the types.
 *
 * Rows carry what a type *is*: the contract it forces (method, path) and how many
 * fields the review process will map, plus the count of connections that already
 * copied it.
 */
export function TemplatesList({
  templates,
  instanceCount,
  onOpen,
  onDelete,
  emptyMessage,
  dict,
}: TemplatesListProps) {
  if (templates.length === 0) {
    return <EmptyRow message={emptyMessage} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {templates.map((template) => (
        <li key={template.id}>
          <TemplateRow
            template={template}
            instances={instanceCount(template.id)}
            onOpen={() => onOpen(template)}
            onDelete={() => onDelete(template)}
            dict={dict}
          />
        </li>
      ))}
    </ul>
  );
}

interface TemplateRowProps {
  readonly template: IntegrationTemplate;
  readonly instances: number;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
  readonly dict: I18nRecord;
}

function TemplateRow({
  template,
  instances,
  onOpen,
  onDelete,
  dict,
}: TemplateRowProps) {
  const fields = schemaLeafPaths(template.requestSchema).length;

  return (
    <div className={ROW}>
      <RowIcon>
        <HiOutlineTemplate className="h-5 w-5" />
      </RowIcon>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900 dark:text-white">
          <button type="button" onClick={onOpen} className={ROW_BUTTON}>
            {template.name}
          </button>
        </div>
        <div className={SUBLINE}>
          <span className="font-mono">
            {template.method} {template.path}
          </span>
        </div>
      </div>

      <div className="hidden w-52 shrink-0 flex-col gap-1 sm:flex">
        <div className="flex items-center gap-2">
          <Badge color="gray">{template.providerType}</Badge>
        </div>
        <div className={SUBLINE}>
          {tr("templates.fields", dict, { count: String(fields) })}
        </div>
      </div>

      <div className="hidden w-40 shrink-0 text-right md:block">
        <div className="truncate text-sm text-gray-700 dark:text-gray-300">
          {tr("templates.instanceCount", dict, { count: String(instances) })}
        </div>
      </div>

      <div className="relative shrink-0">
        <RowMenu dict={dict}>
          <DropdownItem icon={HiPencil} onClick={onOpen}>
            {tr("common.edit", dict)}
          </DropdownItem>
          <DropdownItem icon={HiTrash} onClick={onDelete}>
            {tr("common.delete", dict)}
          </DropdownItem>
        </RowMenu>
      </div>
    </div>
  );
}
